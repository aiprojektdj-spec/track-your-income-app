# Stackr plan/ – Konsolidierter Plan (PLAN.md)

Diese Datei ist die konsolidierte Fassung des gesamten `plan/` Ordners, erstellt am 2026-07-27.
Sie fasst alle offenen Session-Prompts, Referenz-/Spec-/Backlog-Dokumente, die monatliche Wachstumsplanung und das README verlustfrei in einer einzigen Datei zusammen (Single Source of Truth), als Ersatz für die vorherige Multi-Datei-Struktur aus ~60 Einzeldateien. Bereits erledigte Aufgaben-Dateien wurden vor der Konsolidierung entfernt (Inhalt bleibt in der Git-Historie erhalten).

## Inhaltsverzeichnis

### Offene Session-Prompts
- [session-prompt-anwalt-briefing.md](#session-prompt-anwalt-briefing-md)
- [session-prompt-blob-sync.md](#session-prompt-blob-sync-md)
- [session-prompt-ch-at-entfernen.md](#session-prompt-ch-at-entfernen-md)
- [session-prompt-lager-feature-batch.md](#session-prompt-lager-feature-batch-md)
- [session-prompt-landing-seo.md](#session-prompt-landing-seo-md)
- [session-prompt-local-spiegeln.md](#session-prompt-local-spiegeln-md)
- [session-prompt-local-sync-fortsetzung.md](#session-prompt-local-sync-fortsetzung-md)
- [session-prompt-local-sync-punkte-16-22.md](#session-prompt-local-sync-punkte-16-22-md)
- [session-prompt-makecom-webhook.md](#session-prompt-makecom-webhook-md)
- [session-prompt-offline-grace-stb.md](#session-prompt-offline-grace-stb-md)
- [session-prompt-onboarding-rebuild.md](#session-prompt-onboarding-rebuild-md)
- [session-prompt-performance-a11y.md](#session-prompt-performance-a11y-md)
- [session-prompt-persona-cta-touch-target.md](#session-prompt-persona-cta-touch-target-md)
- [session-prompt-rechnung-eigenbeleg-vollaudit-2026-07-23.md](#session-prompt-rechnung-eigenbeleg-vollaudit-2026-07-23-md)
- [session-prompt-stb-gate-revoke.md](#session-prompt-stb-gate-revoke-md)
- [session-prompt-stb-luecken.md](#session-prompt-stb-luecken-md)
- [session-prompt-teilzahlung-ratenzahlung.md](#session-prompt-teilzahlung-ratenzahlung-md)
- [session-prompt-ui-politur.md](#session-prompt-ui-politur-md)
- [session-prompt-vercel-blob-empfaenger.md](#session-prompt-vercel-blob-empfaenger-md)
- [session-prompt-vollaudit-a11y-rest.md](#session-prompt-vollaudit-a11y-rest-md)
- [session-prompt-vollaudit-runde2-nacharbeiten.md](#session-prompt-vollaudit-runde2-nacharbeiten-md)
- [session-prompt-whop-checkout-nachpruefung.md](#session-prompt-whop-checkout-nachpruefung-md) — NEU 2026-07-27
- [session-prompt-whop-dpa-anfrage.md](#session-prompt-whop-dpa-anfrage-md)
- [session-prompt-zufluss-teilzahlung-steuermodule.md](#session-prompt-zufluss-teilzahlung-steuermodule-md)

### Referenz-/Spec-/Backlog-Dokumente
- [anwalt-notiz-trial-widerruf.md](#anwalt-notiz-trial-widerruf-md)
- [differenzbesteuerung-25a-offene-luecken.md](#differenzbesteuerung-25a-offene-luecken-md)
- [fixes-eigenbeleg-gobd-2026-07-24.md](#fixes-eigenbeleg-gobd-2026-07-24-md)
- [launch-prompts.md](#launch-prompts-md)
- [launch-woche-2026-07-13.md](#launch-woche-2026-07-13-md)
- [local-sync-backlog-2026-07-25.md](#local-sync-backlog-2026-07-25-md)
- [offene-punkte-2026-07-15.md](#offene-punkte-2026-07-15-md)
- [spec-offline-grace-stb-readonly.md](#spec-offline-grace-stb-readonly-md)
- [todo-rest-2026-07-24.md](#todo-rest-2026-07-24-md)
- [user-live-checks.md](#user-live-checks-md)
- [vollaudit-runde2-2026-07-25.md](#vollaudit-runde2-2026-07-25-md)
- [whop-checkout-spotcheck.md](#whop-checkout-spotcheck-md)
- [whop-dpa-anfrage.md](#whop-dpa-anfrage-md)

### Monatliche Wachstumsplanung
- [2026-07-juli.md](#2026-07-juli-md)
- [2026-08-august.md](#2026-08-august-md)
- [2026-09-september.md](#2026-09-september-md)
- [2026-10-oktober.md](#2026-10-oktober-md)
- [2026-11-november.md](#2026-11-november-md)
- [2026-12-dezember.md](#2026-12-dezember-md)

### README
- [README.md](#readme-md)

---

## session-prompt-anwalt-briefing.md

# Prompt für neue Session (copy-paste) — Anwalts-Briefing erstellen (§11 + §356)

---

Kontext: P0-6 aus `plan/offene-punkte-2026-07-15.md` — Anwalt ist bereits beauftragt,
aber es gibt noch **kein zusammenhängendes Briefing-Dokument**. Diese Aufgabe existiert
bereits als Stichpunkt-Prompt in `plan/launch-prompts.md` (Abschnitt "P0-6 · Anwalts-
Paket schnüren") — dieser Prompt hier ist die ausformulierte Version davon, mit den
konkreten Fundstellen aus dieser Session ergänzt.

**Wichtig zur Einordnung:** Diese Session erstellt NUR das Briefing-Dokument
(Text + Fundstellen + offene Fragen) für den Anwalt — sie ändert NICHT selbst die
Rechtstexte und schickt NICHTS an den Anwalt ab. Das Versenden macht der User.

Zentrale Dateien: `agb.html`, `refund.html`, `datenschutz.html`, `impressum.html`,
`plan/anwalt-notiz-trial-widerruf.md` (bestehende Vorarbeit zu §356), diese Session
soll daraus `plan/anwalt-briefing.md` erstellen (neu, noch nicht vorhanden).

## 1. Aktualitäts-Check zuerst

Die Rechtstexte wurden seit der letzten Anwalt-Notiz mehrfach geändert (u. a.
2026-07-16: CH/AT-Klauseln aus `agb.html`/`datenschutz.html` entfernt, siehe Memory
`ch-at-removal-web.md`). Vor dem Schreiben des Briefings: `git log --oneline -- agb.html
datenschutz.html refund.html impressum.html` durchgehen, damit das Briefing den
AKTUELLEN Stand zitiert, nicht einen veralteten.

## 2. `legal-reviewer`-Agent für Vollständigkeits-/Konsistenz-Check einsetzen

Prüfen lassen (siehe auch `plan/launch-prompts.md` P0-6):
- Ist der Trial (7 Tage, Kartenpflicht, Auto-Charge) in `agb.html` §4, `agb.html` §6
  und `refund.html` §1/§3 überall identisch beschrieben?
- Ist Whop als Merchant of Record überall konsistent benannt (nicht mal "Zahlungs-
  dienstleister", mal "Merchant of Record" mit unterschiedlicher Bedeutung)?
- US-Datentransfer/SCC/DPF-Verweise in `datenschutz.html` — nach der CH-Klausel-
  Entfernung (2026-07-16) nochmal auf Vollständigkeit prüfen, ob die verbleibenden
  DSGVO-Art.-44ff-Passagen noch stimmig sind ohne den Schweiz-Absatz.
- Tote §-Verweise oder Abschnitts-Anker (z. B. `agb.html#empfehlungsprogramm` —
  existiert der Abschnitt noch nach evtl. Umstrukturierung?).

## 3. `plan/anwalt-briefing.md` erstellen — Inhalt

**(a) Konkret zu prüfende Klauseln** — Volltext-Zitat + Fundstelle (Datei:Zeile):
- `agb.html §11` — Haftungsbegrenzung (Softwarefehler, Datenverlust-Haftungsausschluss).
  Zitat + Frage: hält die Begrenzung einer AGB-Kontrolle nach §307 BGB stand,
  insbesondere ggü. Verbrauchern?
- `agb.html §6` + `refund.html §1` — Widerrufsrecht-Klausel, siehe Punkt (b).

**(b) Offene Fragen** (aus `plan/anwalt-notiz-trial-widerruf.md` übernehmen + einbauen,
nicht neu erfinden):
1. Tritt „vollständige Ausführung" i. S. v. § 356 Abs. 5 BGB bei einem
   Dauerschuldverhältnis (Abo) überhaupt so ein, wie die aktuelle Formulierung
   suggeriert, oder braucht es eine Klausel, die auf „in Anspruch genommene Nutzung"
   abstellt?
2. Ist die weiche Formulierung ("wird praktisch erst relevant, sobald...") rechtlich
   haltbar oder zu vage?
3. §11-Haftungsbegrenzung: konkret aus dem AGB-Text zitieren und fragen, ob die
   Formulierung Verbraucherschutz-konform ist.
4. Whop-Checkout §312j Abs. 3 BGB (Nachtrag aus Checkout-Nachprüfung 2026-07-30, siehe
   `## whop-checkout-spotcheck.md` weiter oben): Bestell-Button „Beitreten"/„Zugang
   erhalten" statt „zahlungspflichtig bestellen" — legal-reviewer stuft als 🟡 GELB ein
   (OLG Köln spricht dagegen, KG-Berlin-Ausnahme passt nicht, da finaler Button ohne
   Zwischenschritt). Zusätzlich: Stackr-AGB im Checkout nicht verlinkt (nur Fließtext-
   Erwähnung), kein Widerrufsverzicht-Hinweis vorhanden. Alle drei Punkte sind Whop-
   Template-seitig, nicht in Stackr-Code fixbar — Frage an Anwalt: eigenes Haftungsrisiko
   für Stackr als Vermittler/Nutznießer trotz fremdem Checkout-Template?

**(c) Fakten-Steckbrief** (damit der Anwalt nicht erst recherchieren muss):
- Preis: 15 €/Monat, 135 €/Jahr, inkl. MwSt.
- 7-Tage-Trial mit Kartenpflicht, Auto-Charge nach Ablauf, 1× pro Whop-Konto.
- Whop (Whop Inc., USA) als Merchant of Record — Payment + Auth, SCC/DPF als
  Transfermechanismus.
- Datenhaltung: lokal-first (Browser localStorage/IndexedDB), optionaler
  Ende-zu-Ende-verschlüsselter Cloud-Sync auf EU-Servern (Vercel/Upstash, Frankfurt).
- Zielgruppe: Freelancer, Kleinunternehmer, GbR (Deutschland, seit 2026-07-16 kein
  CH/AT-Angebot mehr, siehe Memory `ch-at-removal-web.md` — falls der Anwalt nach
  Schweizer Klauseln fragt: die wurden bewusst entfernt, App ist jetzt DE-only).

## Abschluss

- `plan/anwalt-briefing.md` ist das Ergebnis — 1-seitig, klar strukturiert nach (a)/(b)/(c).
- Nichts an `agb.html`/`refund.html`/`datenschutz.html`/`impressum.html` selbst ändern.
- Nicht an den Anwalt verschicken — das macht der User.
- `plan/offene-punkte-2026-07-15.md` (P0-6-Zeile) und `plan/anwalt-notiz-trial-
  widerruf.md` nach Abschluss verlinken/aktualisieren.

---

**Modell-Empfehlung: Sonnet 5.** Grund: strukturierte Recherche + Dokumentenerstellung,
keine eigene Rechtsentscheidung nötig — das `legal-reviewer`-Subagent-Ergebnis wird nur
sauber aufbereitet, nicht neu bewertet.

---

## ~~session-prompt-blob-sync.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste)

---

Kontext: Am 2026-07-15 wurde das Cloud-Sync-Speicherlimit umgebaut, weil Vercel Serverless
Functions ein hartes 4,5-MB-Body-Limit haben (Plattform, nicht konfigurierbar) — das alte
`MAX_CIPHER=8MB` in `api/sync.js` war dadurch nie real erreichbar. Neue Architektur: große
Anhänge (Rechnungslogo, Eigenbeleg-Foto/-PDF, übergroßes Ledger-Chiffrat) werden aus dem
Sync-JSON ausgelagert und einzeln über Vercel Blob transportiert (`api/blob-upload.js`,
`js/blob-attachments.js`), inkl. Transport-Chunking für Payloads >4MB. Gleichzeitig wurden
Eigenbelege von localStorage auf IndexedDB migriert (waren vorher ungecacht, 5-10MB-Deckel).

Der Umbau ist **im Code fertig, aber komplett uncommittet** und **nur gegen einen gemockten
`fetch` verifiziert** — kein einziger echter Request ist bisher gegen einen echten Vercel-Blob-
Store gelaufen. Das ist der aktuell größte offene Launch-Blocker.

Zentrale Dateien: `api/blob-upload.js` (neu, Whop-authentifiziert, Aktionen `put`/`chunk`+`commit`/
`delete`), `api/blob-cleanup.js` (neu, täglicher Cron räumt verwaiste Chunk-Temp-Objekte
`stackr/tmp/` >24h auf, nur aktiv wenn `CRON_SECRET` gesetzt), `js/blob-attachments.js` (neu,
Client-Transport-Layer + generisches Auslagern von `data:...`-Strings >20.000 Zeichen,
Content-Hash-Cache `oyi_sync_blobcache_<scope>` gegen Doppel-Uploads), `js/cloud-sync.js`
(`_syncScope` hydriert/lagert aus, `deleteRemote(scope)` räumt referenzierte Blobs bei
Art.-17-Löschung mit auf), `api/sync.js` (`MAX_CIPHER` jetzt 3,5MB, akzeptiert `{blobUrl, iv}`
als Alternative zu `{ciphertext, iv}`), `app.html` (CSP `connect-src` um
`https://*.public.blob.vercel-storage.com` erweitert), `package.json`/`package-lock.json`
(neue Abhängigkeit `@vercel/blob` 2.6.1).

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM Edit
die Datei frisch lesen; nur eigene Dateien stagen.

## Aufgaben

**1. Diff-Review vor dem Commit**
- Gehe `git status`/`git diff` komplett durch (12 geänderte + 5 neue Dateien). Prüfe, dass
  keine Debug-Reste, Konsolen-Logs mit sensiblen Daten oder halbfertige Codepfade drin sind.
- Verifiziere die bekannte Lehre aus dem letzten Fund: `Store._syncReadRaw()` gibt trotz des
  Namens bereits GEPARSTE Werte zurück — grep nach jeder `_syncReadRaw`-Nutzung und stelle
  sicher, dass niemand das Ergebnis nochmal durch `JSON.parse()` jagt.
- Grep zusätzlich nach `eigenbelege_belege` über den ganzen Repo (nicht nur `eigenbelege/js/app.js`)
  — `js/euer.js`, `rechnungen/js/rechnung.js`, `js/lager.js`, `js/schweiz.js` wurden schon auf
  `Store._syncReadRaw(key) || fallback` umgestellt; verifiziere, dass es keine fünfte/sechste
  Stelle gibt, die noch roh `localStorage.getItem('eigenbelege_belege')` liest.

**2. Lokales Setup + Infra (so weit wie ohne User-Zugangsdaten möglich)**
- `npm install` lokal ausführen (package-lock.json existiert, node_modules fehlt).
- Prüfe, ob `BLOB_READ_WRITE_TOKEN` und `CRON_SECRET` als Env-Var lokal/im Preview verfügbar
  gemacht werden können, oder ob das zwingend echtes Vercel-Dashboard braucht (dann als
  Nicht-Prompt-Punkt für den User dokumentieren: Blob-Store im Storage-Tab anlegen → setzt
  `BLOB_READ_WRITE_TOKEN` automatisch; `CRON_SECRET` manuell setzen).

**3. Echter Live-Test (kein Mock mehr)**
- Preview-Server starten, mit echtem oder geseedetem Whop-Pro-Zugang (siehe
  `plan/session-prompt-stb-luecken.md` für die Whop-Gate-Umgehungstechnik im Preview).
- Roundtrip real durchspielen: großes Rechnungslogo (>20.000 Zeichen Base64) hochladen →
  im Netzwerk-Tab prüfen, dass es als `blobUrl` ausgelagert wird, nicht inline im Sync-Body.
- Chunking real testen: einen Anhang >4MB erzeugen (z. B. großes Eigenbeleg-Foto), prüfen dass
  `chunk`+`commit` korrekt durchläuft und die zusammengesetzte Datei nach Hydrate identisch
  zum Original ist (Hash-Vergleich).
- Content-Hash-Cache verifizieren: denselben Anhang zweimal syncen, im Netzwerk-Tab prüfen
  dass der zweite Sync KEINEN erneuten Blob-Upload auslöst.
- Art.-17-Löschung (`deleteRemote`) real auslösen und im Vercel-Blob-Dashboard (oder per
  `list()`-Aufruf) verifizieren, dass die referenzierten Blob-Objekte wirklich weg sind,
  nicht nur der Sync-Eintrag.
- CSP prüfen: Kein `connect-src`-Fehler in der Konsole beim Blob-Request.

**4. Bekannte, akzeptierte Lücken NICHT nachbauen (sind bewusst offen)**
- Superseded Blob-Anhänge (Feld geändert → alter Blob bleibt bis zur nächsten Art.-17-Löschung)
  werden nicht per Referenzzählung aufgeräumt — das ist ein akzeptiertes kleines Kosten-Leck,
  keinen Fix dafür bauen ohne expliziten User-Wunsch.
- `js/companies.js`'s `migrateEigenbelegeToCompanies()` schreibt weiter direkt in localStorage —
  für migrierte Bestandsnutzer irrelevant, nicht anfassen.

## Abschluss
- Wenn der Live-Test sauber durchläuft: alle 17 Dateien (12 geändert + 5 neu) mit sauberer
  Commit-Message committen. Nicht deployen — macht der User.
- Wenn etwas bricht: Ursache diagnostizieren, fixen, Test wiederholen, danach erst committen.
- Memory `cloud-sync-blob-architecture.md` von "Client-Logik verifiziert, Server nur syntaktisch
  geprüft" auf "echter Live-Test bestanden" aktualisieren (oder auf gefundene Bugs korrigieren).
- Offene Infra-Punkte, die nur der User im Vercel-Dashboard machen kann, in einer kurzen Liste
  am Ende der Session nennen.

---

**Modell-Empfehlung: Opus 4.8.** Grund: das ist eine Serverless-Transport-Architektur mit
mehreren verzahnten Fehlerpfaden (Chunking, Hydrate/Offload-Reihenfolge, Content-Hash-Cache,
Art.-17-Löschung über zwei Systeme hinweg) und ein bereits einmal gefundener, nicht-offensichtlicher
Bug in derselben Änderung (`_syncReadRaw` Doppel-Parse) — genau die Art Cross-Modul-Blast-Radius,
bei der ein zu flaches Review reale Datenverluste für Kunden riskiert.

---

## ~~session-prompt-ch-at-entfernen.md~~ (erledigt 2026-07-16, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — W2: Schweiz/Österreich aus Web 1.7 entfernen

---

Kontext: Web 1.7 soll vorerst NUR das deutsche Steuersystem anbieten (Scope-Reduktion vor
Launch). Die CH/AT-Module (`js/schweiz.js`, `js/oesterreich.js`, `js/svs.js` — falls
AT-spezifisch) bleiben im Code erhalten (NICHT löschen, nur deaktivieren/ausblenden), damit
"Local 1.7" (die parallele Variante, siehe Memory `stackr-project-layout.md`) sie behalten
kann. Nur in Web 1.7 (diesem Repo) entfernen — Local 1.7 NICHT anfassen, das ist ein anderer
Ordner/Repo.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor jedem
Edit die Datei frisch lesen; nur eigene Dateien stagen, nie fremde uncommittete Änderungen
mitcommitten. Nicht deployen — das macht der User.

## Aufgaben

1. Finde alle CH/AT-Einstiegspunkte:
   - Länder-Auswahl bei Firma-Anlage (`js/companies.js`)
   - Menüpunkte/Nav-Einträge (`js/topnav.js`, `js/page-shell.js` — falls vorhanden, sonst grep
     nach Navigation-Rendering)
   - Badges/Hinweise in `js/dashboard.js`, `js/euer.js`, `js/ustvoranmeldung.js`,
     `js/vorsteuer.js`, `js/oss.js`
   - Referenzen in `index.html` / `app.html`
   - `grep -rniE "schweiz|oesterreich|österreich|'CH'|'AT'"` über `js/` und `*.html`, um nichts
     zu übersehen.

2. Entferne/verstecke (Feature-Flag oder simple Bedingung, KEIN Löschen der Dateien):
   - Land-Auswahl bei neuer Firma → nur noch Deutschland wählbar (kein CH/AT-Radio/Dropdown
     im Onboarding-Wizard, `js/app.js`).
   - Alle CH/AT-spezifischen Menüpunkte, Badges, Info-Kästen im UI ausblenden.
   - Rechenlogik-Pfade, die CH/AT-Land prüfen, so absichern, dass sie in Web 1.7 nie erreicht
     werden (da eh keine CH/AT-Firma mehr anlegbar ist) — die Funktionen selbst NICHT löschen,
     nur den Zugang kappen.

3. Bestandsschutz prüfen: Falls in Produktion bereits echte CH/AT-Kunden existieren, darf
   deren bestehende Firma nicht kaputtgehen, nur weil Neuanlage gesperrt ist. Vor hartem
   Sperren kurz mit dem User klären, ob es aktuell schon CH/AT-Bestandskunden gibt (Stand
   2026-07-16: unklar, im Zweifel nachfragen statt raten).

4. Browser-Smoke (Edge-Browser, siehe Memory `feedback-browser-edge.md`): Neue Firma anlegen
   → nur Deutschland wählbar; alle DE-Flows (EÜR, UVA, Rechnungen) unverändert
   funktionsfähig.

## Akzeptanz

CH/AT in Web 1.7 UI nicht mehr erreichbar, Local 1.7 unangetastet, DE-Flow verifiziert,
committet mit klarer Message ("Web 1.7: CH/AT vorerst deaktiviert, Local 1.7 unberührt").

---

## ~~session-prompt-lager-feature-batch.md~~ (fertig bis auf Live-Test durch User, siehe plan/OFFEN.md §4)

**Status: Punkt 6, 4, 7, 1, 5, 3, 8, 9 gebaut + browserverifiziert (2026-07-23/24).** Rest (2, 10)
noch offen, siehe Fortschritts-Notiz am Dateiende. **Punkt 2 hat jetzt eine eigene Datei:**
`plan/session-prompt-lager-status-editierbar.md`.

# Prompt für neue Session (copy-paste) — Lager-Modul Feature-Batch + USt-ID-Bug

---

## Kontext

Ein Kunde hat per WhatsApp eine Liste von Wünschen fürs Lager-Modul + einen Rechnungs-Bug
gemeldet (siehe Screenshots in der Plan-Session vom 2026-07-23). Diese Datei bündelt die
geklärten Anforderungen aus einer Q&A-Runde mit dem User (nicht dem Kunden direkt) und ist die
Bauvorlage für die Umsetzung. Vorher `git status`/`git log` frisch prüfen.

Betroffene Dateien (Stand der Recherche 2026-07-23): `js/lager.js` (Haupt-Lagerlogik, ~2400
Zeilen), `js/store.js` (Datenhaltung, company-scoped via `_rechPrefix`/`_prefix`),
`rechnungen/js/rechnung.js` (`addPositionFromLagerArt()` ~Zeile 448, `mergeRechSettings()` Zeile
18, `generatePreviewHtml()` Zeile 1050), `rechnungen/js/unternehmensdaten.js` (Firmenstammdaten
inkl. USt-IdNr.), `eigenbelege/js/app.js` (Eigenbeleg-Formular).

---

## 1. Kategorien: frei editierbar + festes Zielgruppe-Feld

**Ist-Zustand:** `Lager.STATUS`-unabhängige Warenkategorie ist eine hart codierte Liste
(`js/lager.js` ~Zeile 659): Kleidung, Schuhe, Elektronik, Bücher, Haushalt, Sport, Accessoires,
Sonstiges. Kein Verwaltungs-UI, keine eigenen Kategorien möglich.

**Soll (User-Entscheidung: "Beides kombiniert"):**
1. Warenkategorie wird frei editierbar: Nutzer kann eigene Kategorien anlegen/umbenennen/löschen.
   Die 8 bestehenden Werte werden beim ersten Aufruf als Start-Vorschlag in den company-scoped
   Store migriert (nicht hart im Code bleiben).
2. Zusätzlich ein neues, festes Feld "Zielgruppe" (Vorschlag: Herren/Damen/Unisex — ggf. auch
   Kinder ergänzen, mit User beim Bauen kurz abstimmen) als separate Auswahl am Artikel.
3. Beide Felder im Artikel-Anlegen/-Bearbeiten-Formular UND als Filter in der Lager-Übersicht.

**Bauplan-Hinweis:** analog zum bestehenden `Store.getEinkaufsquellen()`/`addEinkaufsquelle()`-
Muster (Zeile 2162 ff. in `js/lager.js`) — company-scoped Liste mit Schnellauswahl + "Sonstiges
…"-Custom-Add. Für Kategorien zusätzlich Löschen/Umbenennen-UI nötig (Einkaufsquelle hat das noch
nicht).

---

## 2. Status: frei editierbar, bestehende 7 als Vorschläge

**Ist-Zustand:** `Lager.STATUS_CONFIG` (Zeile 37-45) ist ein hart codiertes Objekt mit 7 Werten
(verfuegbar, reserviert, verkauft, beschadigt, reinigung, reparatur, ausgelistet), inkl. Farbe/
Icon/Badge-Klasse. Wird an ~12 Stellen im Code referenziert (Filter, Badges, Bulk-Status, Export,
Sortierung).

**Soll (User-Entscheidung: "Voll frei + Vorschläge"):** Nutzer kann eigene Status anlegen,
umbenennen, löschen. Die 7 aktuellen Werte sind Vorbelegung (Vorschlag), keine Pflicht.

**Wichtig beim Bauen:**
- Company-scoped Custom-Status-Store nötig (wie Kategorien).
- Migration: bestehende Artikel mit `status: 'verkauft'` etc. müssen nach Umbau weiter
  funktionieren, auch wenn der Nutzer den Vorschlag später umbenennt/löscht (Fallback-Label für
  verwaiste Status-Keys einbauen, sonst brechen alte Datensätze in der Anzeige).
- `verkauft`/`verfuegbar` sind an mehreren Stellen im Code (nicht nur Anzeige) als String-Literal
  fest verdrahtet (z.B. `js/store.js` `stornoSale()`, `deleteSale()`, `js/lager.js` Zeile 1516/
  1568/1834 `p.status === 'verfuegbar'`). Diese Business-Logik-Stati (verfügbar/verkauft) sollten
  intern als stabile System-Keys bestehen bleiben und NICHT umbenennbar/löschbar sein — nur die
  übrigen (reserviert, beschadigt, reinigung, reparatur, ausgelistet) plus neue eigene Status sind
  frei. Das vorher mit dem User klären, sonst brechen Storno-/Verkaufslogik.

---

## 3. Farben: Mehrfachauswahl pro Artikel

**Ist-Zustand:** 1 Farbe pro Artikel via `<input type="color">` (Zeile 1438-1442), kein Array.

**Soll (User-Entscheidung: "Mehrere Farben pro Artikel"):** Ein Artikel kann mehrere Farben
gleichzeitig haben (z.B. zweifarbiger Schuh). `p.farbe` (string) → `p.farben` (array) umbauen.
UI: Farb-Chips zur Mehrfachauswahl aus vordefinierter Palette + "eigene Farbe"-Picker wie bisher,
mehrfach hinzufügbar.

**Migration:** bestehende `p.farbe`-Werte beim Lesen in `p.farben: [p.farbe]` überführen
(Lazy-Migration wie schon bei `artikelNr`, Zeile 93-111 — gleiches Muster nutzen).

---

## 4. Artikelnummer: manuell editierbares Feld, eigener Filter

**Ist-Zustand:** `p.artikelNr` wird automatisch vergeben (Zeile 93-111, Format `JAHR-NNN`), taucht
nur in der allgemeinen Volltextsuche auf (Zeile 559), kein eigenes Filterfeld in der
Lager-Übersicht.

**Soll:** Artikelnummer bleibt 1 Wert pro Artikel (kein Tag-Array), aber:
1. Manuell editierbar/überschreibbar sowohl im Einzel- als auch im Bulk-Einkauf-Formular (aktuell
   nur automatisch vergeben, kein Eingabefeld).
2. Eigenes Filterfeld in der Lager-Übersicht, unabhängig von Größe/Marke/Kategorie filterbar
   (bisher nur Teil der kombinierten Textsuche).

---

## 5. Neues Feld "Lieferant/Händler" (getrennt von Einkaufsquelle)

**Ist-Zustand:** `p.einkaufsquelle` existiert bereits als company-scoped Liste mit Schnellauswahl
(`Store.getEinkaufsquellen()`/`addEinkaufsquelle()`, Zeile 2162 ff.) — aber nur im
Artikel-Bearbeiten-Formular (`le_einkaufsquelle`), nicht als Filter, nicht in Bulk-Einkauf, nicht
in Eigenbelegen geprüft.

**Soll (User-Entscheidung):** Einkaufsquelle = Kanal (z.B. "Vinted", "Retoure", "Flohmarkt").
Neues, separates Feld **Lieferant/Händler** = konkreter Name der Person/Firma (z.B. "Max
Mustermann", "Schuh GmbH"):
1. Neues Feld `p.haendler` (o.ä.), company-scoped Liste mit Schnellauswahl nach demselben Muster
   wie Einkaufsquelle (`Store.getHaendler()`/`addHaendler()` + "Sonstiges …"-Custom-Add).
2. Muss existieren in: Einzel-Einkauf-Formular, Bulk-Einkauf-Formular, UND im
   Eigenbeleg-Formular (`eigenbelege/js/app.js` — dort prüfen, ob es ein äquivalentes Feld/Konzept
   schon gibt, sonst neu anlegen).
3. Als Filter in der Lager-Übersicht (das war der ursprüngliche Wunsch "Dienstleister filtern").

**Vorab prüfen:** ob `Store.getEinkaufsquellen()` als Vorlage 1:1 kopierbar ist oder ob es
Sinn macht, eine gemeinsame generische Helper-Funktion für "company-scoped Schnellauswahl-Liste"
zu bauen, da jetzt mindestens 3 solcher Felder existieren (Einkaufsquelle, Kategorie, Händler) —
Code-Duplikation vermeiden.

---

## 6. Storno-Freigabe auch bei festgeschriebenen (gesperrten) Belegen

**Ist-Zustand:** `Store.stornoSale()` (`js/store.js` Zeile 1470-1497) setzt den verknüpften
Einkauf beim Verkaufs-Storno automatisch zurück auf `status: 'verfuegbar'` — **außer** der Einkauf
ist bereits GoBD-festgeschrieben (`!this.isLocked(p)`-Check, Zeile 1489). Bei festgeschriebenen
Belegen (z.B. nach Rechnungsstorno eines abgeschlossenen Zeitraums) bleibt der Artikel dauerhaft
fälschlich auf "Verkauft" stehen. Das war vermutlich der Kern von "Verkaufte Sachen die storniert
wurden aus verkauft rausnehmen" + "Erneut hochladen nach Stornierung".

**Soll (User-Entscheidung, mit Vorbehalt):** "Ja, solange das GoBD-konform ist" — Lager-Status
soll auch bei gesperrten Belegen auf "Verfügbar" zurückgesetzt werden können. Freigabe ist rein
intern (nur wieder als verfügbar im Lager sichtbar/filterbar), **kein** externes
Neu-Einstellen auf Verkaufsplattformen.

**GoBD-Einschätzung (vorläufig, vor Bau mit `legal-reviewer`-Agent absichern):** Der `status`
eines Lagerartikels ist reine Bestandsführungs-Metadatum, keine Finanzbuchung/kein
Rechnungsinhalt — die eigentliche GoBD-relevante Unveränderbarkeit betrifft die Rechnung/den
Verkaufsbeleg selbst (bleibt storniert + Audit-Trail über `_addAuditEntry`), nicht den
Lagerbestand. Sollte daher unkritisch sein, aber vor dem Bauen kurz mit dem `legal-reviewer`-Agent
gegenchecken, da der User selbst "solange das GoBD-konform ist" als Bedingung genannt hat.

**Bauplan:**
1. `Store.stornoSale()`: `!this.isLocked(p)`-Check für die reine Status-Rückgabe entfernen (Audit-
   Trail-Eintrag bleibt in jedem Fall bestehen, unabhängig vom Lock-Status).
2. Gleiche Änderung in `deleteSale()` (Zeile 1499-1523, hat denselben Lock-Check) prüfen — dort
   wird bei offener Periode ohnehin storniert statt gelöscht, aber der Freigabe-Check ist separat.
3. Kein neuer UI-Text/Button nötig — bestehender Storno-Flow reicht, Ergebnis ist einfach dass der
   Artikel danach wieder als "Verfügbar" filterbar ist.

---

## 7. Eigenständiges Anmerkungen-Feld am Artikel

**Ist-Zustand:** Es gibt bereits ein Notizen-Feld, aber nur am **Verkauf** (`s.notizen`, Formular
`vk_notizen`/`se_notizen`), nicht am Einkauf/Artikel selbst.

**Soll (User-Entscheidung):** Neues freies Textfeld direkt am Artikel/Einkauf (`p.anmerkung`),
unabhängig vom späteren Verkaufs-Notizfeld — z.B. "Kratzer an der Sohle", "Geschenk von XY".
Im Einzel- und Bulk-Einkauf-Formular ergänzen, in Tabellen-/Detailansicht und CSV-Export
mitführen (analog zur bestehenden `Quelle`/`Notizen`-Spalte im Export, Zeile 1107-1108/1123).

---

## 8. Suchleisten global auf Klick-Suche umstellen

**Ist-Zustand:** mind. die Lager-Suche (`js/lager.js` Zeile 1896) sucht live bei jedem
Tastendruck (`addEventListener('input', ...)`).

**Soll (User-Entscheidung: "Überall in der App"):** Alle Live-Suchfelder auf Klick-Suche
(Such-Button oder Enter-Taste) umstellen, nicht nur Lager.

**Bauplan:** vor dem Bauen eine kurze Bestandsaufnahme aller `addEventListener('input', ...)` an
Suchfeldern app-weit machen (Rechnungen/Kunden/Produkte, Eigenbelege, ggf. weitere Module) — nicht
blind alle `input`-Listener anfassen, da manche live-Filter (Zahlenfelder, Formulare) NICHT
gemeint sind, nur Text-Suchfelder. Einheitliches Muster: Enter-Taste ODER Klick auf Such-Icon löst
aus, Eingabe selbst löst nichts mehr aus.

---

## 9. "Artikel aus Lager hinzufügen"-Dialog (Rechnungen): volle Filter + Bild

**Ist-Zustand:** `addPositionFromLagerArt()`-Dialog in `rechnungen/js/rechnung.js` (~Zeile 448,
siehe `js/lager.js` Zeile 1158 `availPurchases`) zeigt aktuell verfügbare Lagerartikel ohne Bild
und ohne eigene Such-/Filterleiste.

**Soll (User-Entscheidung: "Volle Filter + Bild"):** Gleiche Filter wie in der Lager-Übersicht
(Kategorie, Marke, Status, Zielgruppe, Händler etc. — nach Bau der Punkte 1+5 oben) zusätzlich zu
einem Vorschaubild pro Zeile (Artikel hat bereits `p.foto`, siehe Zeile 161 in `js/lager.js`).
Sinnvoll als Reihenfolge: erst Punkt 1+5 bauen, dann diesen Dialog auf die dort neu entstandenen
Filterfelder erweitern.

---

## 10. USt-ID fehlt auf GbR-Rechnungen (Regelbesteuerung) — Diagnose vor Fix

**Ist-Zustand (verifiziert per Code-Lesen 2026-07-23):** Beide Haupt-Renderpfade lesen die USt-ID
korrekt company-scoped:
- `rechnungen/js/rechnung.js` `mergeRechSettings()` (Zeile 18-32): merged
  `Store.getRechUnternehmen()` (company-scoped über `_rechPrefix`, `js/store.js` Zeile 2109) in
  `Store.getSettings()`, `ustId` wird korrekt übernommen wenn nicht leer.
- `generatePreviewHtml()` (Zeile 1050 ff.) nutzt `mergeRechSettings()`, rendert die Tax-Zeile
  (Zeile 1182-1188) wenn `settings.steuernummer || settings.ustId` gesetzt ist — unabhängig vom
  Kleinunternehmer/Regelbesteuerung-Modus.
- `rechnungen/js/xrechnung.js` `mergeSettings()` (Zeile 326-336) macht dasselbe für den
  XRechnung-XML-Export.

Der Code-Pfad selbst scheint also korrekt. User-Angabe: Bug betrifft konkret die **GbR**-Firma,
soll bei **jeder neuen** Rechnung erscheinen (kein Snapshot-/Altbestand-Problem).

**Wahrscheinlichste Ursachen (zu prüfen, bevor irgendwas geändert wird):**
1. **Naheliegendste Erklärung:** Unter der aktiven GbR-Firma ist im Formular "Unternehmensdaten"
   (`ud_ustId`, `rechnungen/js/unternehmensdaten.js` Zeile 122/346) schlicht kein Wert
   eingetragen — jede Firma hat eigene, company-scoped Unternehmensdaten. Falls die USt-ID nur
   unter der anderen Firma (Einzelunternehmen) hinterlegt wurde, greift für die GbR korrekt der
   leere Fallback. **Erster Schritt der nächsten Session: mit dem User/Testdaten live prüfen, ob
   unter der aktiven GbR das Feld tatsächlich befüllt ist.**
2. Falls das Feld befüllt ist und trotzdem leer erscheint: prüfen ob `Store._companyId` beim
   Firmenwechsel zuverlässig gesetzt ist, BEVOR `unternehmensdaten.js` `_loadData()` aufruft (Race
   zwischen Firmenwechsel-Event und Formular-Render) — ggf. wird beim Speichern unter der falschen
   `_rechPrefix` geschrieben oder das Formular zeigt gecachte Werte der zuvor aktiven Firma.
3. Randfall: GbR + Regelbesteuerung könnte über einen anderen Modul-Pfad laufen
   (`js/gbr-modul.js` statt der normalen Rechnungs-App) — dort prüfen, ob eigene
   Rechnungserzeugung existiert, die NICHT über `mergeRechSettings()`/`generatePreviewHtml()`
   läuft (bisher nicht verifiziert, da außerhalb des Kern-Rechnungsmoduls).

**Bauplan:** Erst Diagnose 1-3 oben durchführen (Live-Test mit Whop-Login durch User nötig, da
Session selbst nicht eingeloggt testen kann), danach gezielten Fix je nach Ursache. Nicht blind
Code ändern ohne bestätigte Ursache — der Kern-Mechanismus sieht beim Lesen korrekt aus.

---

## Reihenfolge-Empfehlung

1. Punkt 6 (Storno-Freigabe) — klein, isoliert, hoher Kundennutzen, GoBD-Check mit
   `legal-reviewer`-Agent vorab.
2. Punkt 10 (USt-ID-Diagnose) — braucht Live-Test durch User, kann parallel/vorab geklärt werden.
3. Punkt 4 + 7 (Artikelnummer-Feld, Anmerkungen-Feld) — klein, unabhängig.
4. Punkt 1 + 5 (Kategorien frei + Zielgruppe + Händler-Feld) — mittelgroß, gemeinsames
   Store-Pattern, sinnvoll zusammen bauen.
5. Punkt 2 (Status frei editierbar) — größter Umbau (STATUS_CONFIG an ~12 Stellen referenziert),
   eigene Session empfehlenswert.
6. Punkt 3 (Farben-Array) — mittelgroß, eigene Migration nötig.
7. Punkt 9 (Lager-Dialog in Rechnungen) — baut auf 1+5 auf, danach.
8. Punkt 8 (Suchleisten global) — unabhängig, aber Bestandsaufnahme zuerst.

## Akzeptanzkriterien (pro Punkt beim Bauen ergänzen, hier nur Gesamt-Checkliste)

- Alle Migrationen (Farben-Array, Kategorien, Status) sind lazy/rückwärtskompatibel — bestehende
  Kundendaten (Web + ggf. Local 1.7) brechen nicht.
- `verfuegbar`/`verkauft` bleiben intern stabile System-Keys, unabhängig vom neuen
  Status-Editor.
- Neue Felder (Zielgruppe, Händler, Anmerkung) sind optional, keine Pflichtfelder die bestehende
  Bulk-Importe/Bulk-Einkäufe brechen.
- Browser-Smoke für jeden Punkt einzeln (Whop-Gate — ggf. User für Live-Test einbinden wie bei
  anderen Sessions).
- Nach Abschluss: `plan/todo-rest-*.md` aktualisieren, Local-1.7-Spiegelung einplanen
  (`plan/session-prompt-local-spiegeln.md`).

---

**Modell-Empfehlung: Sonnet 5 reicht für die meisten Punkte.** Punkt 10 (USt-ID) und Punkt 6
(GoBD-Storno-Freigabe) sollten mit dem `legal-reviewer`-Agent gegengecheckt werden, kein Opus
nötig — die fachliche Klärung ist überwiegend schon in dieser Datei erledigt.

---

## Fortschritt 2026-07-23 (Session 2)

Geklärt vorab: Zielgruppe = Herren/Damen/Unisex/Kinder (4 Werte). Scope = Reihenfolge-Empfehlung
abarbeiten, nach 1+5 gestoppt für Review.

**Gebaut + browserverifiziert:**
- **Punkt 6** (Storno-Freigabe bei gesperrten Belegen): GoBD-Check via `legal-reviewer` bestanden
  (Lagerstatus ist kein Buchungsobjekt). `Store.stornoSale()`/`deleteSale()` in `js/store.js` geben
  Lagerstatus jetzt auch bei gesperrten Einkäufen frei, mit explizitem Audit-Trail-Eintrag
  (`'lager-status'`) der die Ausnahme benennt (legal-reviewer-Vorgabe).
- **Punkt 7** (Anmerkungen-Feld): war bereits gebaut (`p.notizen` in Neu-Artikel-Modal,
  Edit-Modal, CSV/XLSX-Export) — Plan-Annahme war veraltet, nichts zu tun.
- **Punkt 4** (Artikelnummer): manuell editierbar in Neu-Artikel-Modal (`neu_artikelnr`),
  Edit-Modal (`le_artikelnr`) und Bulk-Einkauf pro Zeile (`bulk_artikelnr_*`, bei Anzahl>1 wird
  `-1`/`-2`… angehängt, nie beim Duplizieren übernommen). Eigenes Filterfeld `lagerFilterArtikelnr`
  in der Lager-Übersicht. Nebenbei gefixt: Text-Suche verschwand bisher beim Wechsel eines anderen
  Dropdown-Filters (applyFilters baute `_filters` neu ohne `.search`).
- **Punkt 1 + 5** (Kategorien frei + Zielgruppe + Händler): neue generische Store-Helper
  `_getScopedList()`/`_addScopedListItem()` in `js/store.js`, darauf aufbauend
  `getWarenkategorien()/addWarenkategorie()/renameWarenkategorie()/deleteWarenkategorie()` (Rename
  migriert bestehende Artikel automatisch, da Kategorie reiner Anzeigetext ohne Key-Indirektion ist)
  und `getHaendler()/addHaendler()`. Neues festes `Store.ZIELGRUPPEN` (Herren/Damen/Unisex/Kinder).
  Felder in Neu-Artikel-Modal, Edit-Modal und Bulk-Einkauf (dort als gemeinsame Felder für die ganze
  Session, nicht pro Zeile — analog zu Einkaufsquelle/Datum). Neuer "🏷️ Kategorien"-Button im
  Lager-Header öffnet Verwalten-Modal (anlegen/umbenennen/löschen). Filter für Kategorie (jetzt
  dynamisch statt hart codiert), Zielgruppe, Händler in der Lager-Übersicht.
  Eigenbeleg-Formular (`eigenbelege/js/app.js`) hat mit "Verkäufer / Absender" bereits ein
  äquivalentes Feld (`eb-vk-name`) — laut Plan-Vorgabe unverändert gelassen.

**Nicht angefasst (bewusst, laut Reihenfolge-Empfehlung):** Punkt 2 (Status frei editierbar — größter
Umbau, eigene Session), Punkt 3 (Farben-Array), Punkt 8 (Suchleisten global), Punkt 9 (Lager-Dialog in
Rechnungen — baut auf 1+5 auf, jetzt möglich), Punkt 10 (USt-ID-Diagnose — braucht Live-Test durch User).

**Offen:** Local-1.7-Spiegelung der Punkte 6/4/7/1/5 (siehe `plan/session-prompt-local-spiegeln.md`).

---

## ~~session-prompt-landing-seo.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — P1-2: Landing-Copy + SEO

---

Kontext: Stackr steht kurz vor Launch. Die Landing-Page (`index.html`, live an `/`) hat
bereits solide SEO-Grundlagen (Title, Description, canonical, OG/Twitter-Tags,
`sitemap.xml`, `robots.txt`) — das ist NICHT bei null. Aufgabe: die verbleibenden Lücken
schließen und die Copy vor dem Launch nochmal kritisch lesen (Klarheit, Conversion,
Widersprüche zu AGB/Preis).

Zentrale Dateien: `index.html` (LIVE, an `/` ausgeliefert — kein Rewrite in `vercel.json`
nötig, Vercel serviert `index.html` automatisch als Root), `landing-v2.html` (Status
unklar — geprüft in dieser Recherche: **nicht** über `vercel.json`-Rewrite erreichbar,
aber dupliziert `canonical`/`og:url` auf `https://track-your-income-app.vercel.app/`,
obwohl die Seite selbst nicht unter `/` liegt), `sitemap.xml`, `robots.txt`,
`deploy/index.html` + `deploy/onepager.html` (weitere Landing-Varianten, Zweck erst klären).

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## 1. Erstmal Bestandsaufnahme: welche Landing-Variante ist die echte?

- `index.html`, `landing-v2.html`, `deploy/index.html`, `deploy/onepager.html` existieren
  parallel mit unterschiedlichen Titles/Copy. Klären: ist `landing-v2.html` ein totes
  Prototyp/A-B-Test-Artefakt oder soll sie live? `deploy/` könnte ein separates
  Deploy-Ziel sein (Ordnername prüfen, ob es ein eigenes Vercel-Projekt ist oder Altlast).
- Falls `landing-v2.html` tot ist: canonical/og:url-Duplikat ist ein reines SEO-Risiko
  (Suchmaschinen könnten sie als Duplicate Content werten) — entweder Datei entfernen,
  `noindex` setzen, oder eigenen canonical setzen. Beim User rückfragen, NICHT einfach
  löschen ohne zu wissen ob sie noch gebraucht wird.

## 2. SEO-Feinschliff auf der echten Landing-Page

- `sitemap.xml` listet nur `/`, `agb.html`, `datenschutz.html`, `impressum.html`,
  `cookies.html`, `refund.html` — fehlt `verfahrensdokumentation.html`? Prüfen ob die
  öffentlich/indexierbar sein soll (aktuell nicht in `robots.txt` `Allow`-Liste).
- `og-image.png` — existiert die Datei tatsächlich unter dem referenzierten Pfad? Prüfen,
  Bildgröße/Format gegen OG-Standard (1200×630) checken.
- Structured Data (JSON-LD, z. B. `SoftwareApplication`/`Organization`/`FAQPage` für die
  FAQ-Sektion auf `index.html`) fehlt komplett — prüfen ob sinnvoll ergänzbar ohne die
  bestehende CSP (`script-src 'none'` auf Rechtsseiten, prüfen was auf `index.html` gilt)
  zu brechen.
- H1/H2-Hierarchie auf `index.html` gegenchecken (nur eine H1?), Alt-Texte an allen
  `<img>`/SVG-Icons mit Bedeutung.

## 3. Copy-Review (kritisch lesen, nicht nur SEO)

- FAQ-Antwort zu Steuerberatung (`index.html`, Suche nach "Steuerberater") gegen
  `agb.html §31` (StBerG-Disclaimer) abgleichen — konsistente Formulierung?
- Preis-Kommunikation (15 €/Monat, 135 €/Jahr, 7-Tage-Trial mit Kartenpflicht) auf der
  Landing exakt gegen `agb.html §4` (Trial-Bedingungen) und `js/user-plan.js` prüfen —
  keine widersprüchlichen Zahlen/Bedingungen zwischen Marketing-Text und Rechtstext.
  (Hinweis: `agb-writer`/`legal-reviewer`-Agent für den Rechtstext-Abgleich nutzen, nicht
  selbst umformulieren.)
- CTA-Texte + Trial-Links: nach der W2-Session (CH/AT-Entfernung, 2026-07-16) prüfen, ob
  irgendwo noch "auch für die Schweiz" o. ä. suggeriert wird (war zuvor an mehreren
  Stellen der Fall, siehe Memory `ch-at-removal-web.md`).

## 4. Technisches SEO-Minimum

- Lighthouse-SEO-Score der Landing im Preview messen (vor/nach).
- `Content-Security-Policy` auf `index.html` gegenlesen — blockiert sie evtl. legitime
  Crawler-relevante Ressourcen (z. B. `og-image.png` selbst gehostet? `img-src` prüfen)?
- Mobile-Lesbarkeit der FAQ/Pricing-Sektion im Preview (375px Breite) checken.

## Abschluss

- Jede inhaltliche Copy-Änderung mit Begründung dokumentieren (nicht blind umschreiben).
- Rechtstext-Abgleich klar von reiner SEO-Technik trennen — bei Unsicherheit über
  Preis-/Trial-Formulierungen lieber fragen statt raten (Anwalt-Freigabe für AGB steht
  laut `plan/offene-punkte-2026-07-15.md` noch aus, Landing-Copy sollte dem nicht
  vorgreifen).
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P1-2 nachtragen.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Sonnet 5.** Grund: überwiegend Recherche + Textarbeit + kleine,
gut abgrenzbare technische Fixes (Meta-Tags, Sitemap, JSON-LD) ohne tiefe Systemlogik —
kein Fall für Opus-Reasoning, aber der Rechtstext-Abgleich sollte konservativ bleiben
(im Zweifel fragen statt selbst entscheiden).

---

## session-prompt-local-spiegeln.md

# Session-Prompt — P2-1: Local 1.7 spiegeln + Git reparieren

---

Kontext: Stackr = 2 Varianten, selber Eltern-Ordner. `Web 1.7/` (dies Repo,
live Vercel, kein CH/AT seit 2026-07-16). `Local 1.7/` (Desktop-Variante,
behält CH/AT, siehe Memory `schweiz-modul.md`). `Local 1.7/` Git verwaist:
letzter Commit `6975e9b` (Local-1.6-Ära). Seitdem nur Working-Copy-Arbeit.
Stand 2026-07-16: 70 uncommittete Änderungen (22 neu, 10 gelöscht, 38
modifiziert) gg. altem HEAD.

Kein normaler Feature-Task — Repo-Hygiene, echtes Datenverlust-Risiko.
Vorsicht.

## 1. Erst verstehen, nichts anfassen

- `cd "../Local 1.7"`, `git log --oneline -20`, `git status --short` ganz
  durchgehen (nicht nur Anfang).
- 10 gelöschte Dateien prüfen: Absicht oder Versehen? `ANLEITUNG.html`,
  `datenschutz.html`, `impressum.html` erscheinen gelöscht — letzte zwei
  extra scharf checken (Pflichttexte, dürfen nicht versehentlich fehlen).
- Große Diffs überfliegen (`css/style.css`, `js/app.js`, `index.html`):
  UI-Redesign ("Linear Midnight Command Deck", Emoji→Tabler-Icons) oder
  Feature-Arbeit?
- `git fsck` — verwaist könnte auch `.git`-Zustand selbst kaputt heißen,
  nicht nur alte Historie.

## 2. Mit User klären VOR Commit

Rückfrage-Pflicht, kein Alleingang:
- 70 Änderungen: 1 Commit oder mehrere sinnvoll aufgeteilt (UI-Redesign
  getrennt von Bugfixes)?
- 10 Löschungen: Bestätigung vor `git add -A` (sonst endgültig).
- Remote vorhanden (`git remote -v`)? Falls nicht: Dateisystem-Backup
  vorschlagen vor jeder history-verändernden Git-Operation.

## 3. Web → Local Code-Abgleich — SUPERSEDED, siehe neue Dateien

**Diese Sektion ist veraltet.** Am 2026-07-25 wurde ein vollständiger, empirischer Drift-Audit
gefahren (nicht aus Memories geraten, sondern echter Content-Diff über alle geteilten Dateien) —
das Ergebnis ist um ein Vielfaches gründlicher als die Stichpunkte unten und ersetzt sie
vollständig: `plan/local-sync-backlog-2026-07-25.md` (29 Einzelpunkte + 2 Entscheidungsfragen)
und `plan/session-prompt-local-sync-fortsetzung.md` (Fortsetzungs-Prompt, Punkt 1/22 bereits
erledigt+verifiziert). **Dort weitermachen, nicht hier.**

Alte, überholte Stichpunkte (nur zur Historie, nicht mehr verwenden): USt-Regelbesteuerung-Fixes,
GoBD Edit/Delete-Rework, Whop-Gate Signed Grace-Token, Datum-Handling `sv-SE` — alle sind im neuen
Audit erneut/gründlicher erfasst.

## Abschluss

- Erst nach Rückfrage + Bestätigung committen.
- Klarer `git log`, sinnvolle Messages — kein Sammel-Commit ohne
  Beschreibung.
- Memory `csp-haertung-fortschritt.md` + `datum-lokal-sv-se.md` danach
  aktualisieren.
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P2-1 nachtragen.
- Nicht deployen — `Local 1.7/` ist Desktop-lokal, keine Vercel-Variante.

---

**Modell: Opus 4.8.** Grund: hohes Stille-Datenverlust-Risiko
(uncommittete Löschungen, unklarer Git-Zustand, 2 parallele Repos mit
bewusst unterschiedlichem Feature-Set) — braucht sorgfältiges Abwägen vor
jeder Git-Operation, nicht nur Pattern-Matching gg. Web 1.7.

---

## ~~session-prompt-local-sync-fortsetzung.md~~ (alle Punkte fertig, nur D6-Rechtstext offen, siehe plan/OFFEN.md §2.2/§6)

# Session-Prompt — Local-1.7-Sync fortsetzen (Modul 2 von 20)

---

Kontext: Am 2026-07-25 wurde ein vollständiger Drift-Audit Web 1.7 ↔ Local 1.7 gefahren
(echter Content-Diff, nicht aus alten Memories geraten) — Ergebnis in
`plan/local-sync-backlog-2026-07-25.md`. Praktisch jede geteilte Datei war auseinandergelaufen,
29 Einzelpunkte (B1-B29) gefunden. User-Entscheidungen: CH/AT bleibt in Local (kein Entfernen),
Abarbeitung **modul-/dateiweise** (nicht nach Priorität), Reihenfolge steht im Abschnitt
"Vorgehen — Modul-weise Abarbeitung" derselben Datei.

**Vor dem Weitermachen:** `git status`/`git log` in BEIDEN Ordnern frisch prüfen — Repo wird oft
parallel bearbeitet (siehe Memory `multi-session-coordination-technique`), und Web hatte zum
Zeitpunkt des Audits mehrere uncommittete Dateien (Lager-Refactor in Arbeit, s. Section A der
Backlog-Datei) — prüfen, ob die inzwischen committet sind.

## Stand

**Punkt 1 von 22 (`js/store.js`) ist fertig, committet-fähig und browserverifiziert** (2026-07-25):
Rechnungsnummer Peek/Lock, isKlein-Snapshot (Store-Teil), Gutschrift-Guard in `stornoSale`,
§25a-Vortragsspeicher, GoBD-Periodensperre-Warnung, Artikelnummer-Stabilität,
Lager-Store-Erweiterungen (Kategorien/Status/Zielgruppen/Händler), Storno-Freigabe-Reihenfolge-Fix.
Dabei wurden zwangsläufig auch die abhängigen Aufrufer mitgezogen: `rechnungen/js/rechnung.js`
(inkl. `wasAutoPreview`-Fix, im Test gefunden — ohne den hätte jede neue Rechnung dieselbe Nummer
vorgeschlagen bekommen), `wiederkehrend.js`, `dokumente.js`, `js/buchungen.js`
(Storno-Invoice-Guard). Alle per `node --check` + echtem Browser-Test in Local verifiziert
(Rechnung anlegen → korrekte Nummernfolge, Storno → korrekte SR-Nummer, Original als storniert
markiert). Details/Commit-Notiz siehe Abschnitt 1 der Backlog-Datei.

**Noch NICHT committet** — falls eine neue Session das übernimmt, zuerst `git status` in
`Local 1.7/` prüfen, ob die store.js-Änderungen noch als Working-Copy-Diff vorliegen oder
zwischenzeitlich von einer anderen Session committet wurden.

## Weiter mit Punkt 2

Laut Vorgehen-Liste in `plan/local-sync-backlog-2026-07-25.md`:

2. **`js/steuer-berechnung.js`** (Section C) — komplett neue Datei, 1:1 aus Web 1.7 nach
   Local 1.7 kopieren + `<script>`-Tag in `Local 1.7/app.html` ergänzen (an der Stelle, wo Web
   sie lädt — vor `bilanz.js`/`euer.js`, da beide davon abhängen).
3. **`js/bilanz.js`** — B2: 0%-Satz-Bug (`parseFloat(x) || 19` behandelt 0% fälschlich als 19%,
   weil `0` in JS falsy ist) + Umstellung auf `SteuerBerechnung.nettoSales/nettoPurchases/
   nettoExpenses/nettoRechnungen`.
4. **`js/euer.js`** — B1 (§25a-Aufschlüsselung), B2 (SteuerBerechnung), B5 (Gutschriften), B20
   (Wareneinkauf bei storniertem Verkauf), B25 (EÜR/UVA-Sub-Tab-Merge — UI-Umbau, Sidebar-Eintrag
   in `app.html` entfernen).
5. **`js/ustvoranmeldung.js`** — B1, B5, B9 (Ist-UVA zählt bezahlte Rechnungen NICHT, kritischer
   USt-Unterdeklarations-Bug — Local filtert aktuell `!s._invoiceId` heraus, das ist genau falsch
   herum), B12, B26.
6. **`js/gbr-modul.js` + `js/gbr.js`** — B1, B8. **Wichtig:** B8 ist ein echter Rechenfehler mit
   Geldbezug (toter Store-Key `'ausgaben'` statt `'expenses'` → Betriebsausgaben in der
   GbR-Gewinnverteilung sind in Local aktuell immer 0). Betrifft das eigene GbR-50/50-Setup des
   Users (Memory `steueragent-setup`) — bei diesem Punkt besonders sorgfältig testen (echte Zahlen
   prüfen, nicht nur Syntax).

(Rest der Liste: `plan/local-sync-backlog-2026-07-25.md` Abschnitt "Vorgehen", Punkte 7-22.)

## Arbeitsweise (bewährt aus Punkt 1)

1. Web-Code lesen (Grep nach den in der Backlog-Datei genannten Funktionsnamen/§-Referenzen),
   Local-Gegenstück lesen, Unterschied genau verstehen — nicht blind copy-pasten, Local hat
   teils andere Codepfade drumherum (CloudSync-Hooks rausfiltern, Webhooks.js existiert in
   Local nicht, etc.).
2. Änderung in Local einbauen.
3. `node --check <datei>` auf jede geänderte Datei.
4. Browser-Smoke-Test: `stackr-local`-Preset aus `.claude/launch.json` (Port 3344), Firma
   anlegen falls nötig, betroffenen Flow durchklicken (bei Steuer-Modulen: reale Zahlen prüfen,
   nicht nur "lädt ohne Fehler").
5. Nach jedem fertigen Modul: Eintrag in `plan/local-sync-backlog-2026-07-25.md` als erledigt
   markieren (durchstreichen + kurze Notiz, wie bei Punkt 1 geschehen), TaskUpdate falls
   Task-Liste noch aktiv ist.

## Nach Abschluss aller 22 Punkte

- Commit(s) in `Local 1.7/` — mit User klären ob 1 großer oder mehrere thematische Commits
  sinnvoller sind (Local-Git ist orphaned/eigenständig, siehe `session-prompt-local-spiegeln.md`
  für die separate, noch offene Git-Hygiene-Frage — NICHT Teil dieses Sync-Backlogs).
- Memory `local-sync-backlog-2026-07-25` aktualisieren (Status "komplett abgearbeitet").
- Separates, noch nicht begonnenes Feature nicht vergessen: `plan/session-prompt-local-web-
  datentransfer.md` (Firmen-Auswahl-Export in Local + neuer Import-Button in Web) — unabhängig
  von diesem Sync-Backlog, baut auf `js/backup-crypto.js` auf.

---

**Modell-Empfehlung: Opus, nicht Sonnet.** Grund: mehrere der verbleibenden Punkte sind
Steuerrecht mit echtem Geldbezug (§25a, GbR-Gewinnverteilung, Ist-UVA-Unterdeklaration) — hohe
Fehlerkosten bei falscher Portierung, lohnt die sorgfältigere Modellwahl. Sonnet reicht evtl. für
die rein technischen/UI-Punkte weiter hinten in der Liste (ab Punkt 15 aufwärts).

---

## ~~session-prompt-local-sync-punkte-16-22.md~~ (alle Punkte fertig, nur D6-Rechtstext offen, siehe plan/OFFEN.md §2.2/§6)

# Session-Prompt — Local-Sync-Backlog Punkte 16–22 (Rest)

Fortsetzung von `plan/local-sync-backlog-2026-07-25.md`.

**Stand 2026-07-27: Punkte 1–16 sind erledigt.** Punkt 10 ist damit inkl. `rechnung.js`
vollständig (der separat geplante Prompt `plan/session-prompt-local-rechnung-js.md` wurde nie
angelegt und wird nicht mehr gebraucht — Details im Backlog unter Punkt 10). Punkt 16 ebenfalls
erledigt, inkl. drei Zusatzfunde (toter `jahresReset`-Schalter, `esc()` ohne `'`-Escaping,
7 ungepinnte CDN-Ressourcen ohne SRI in `eigenbelege/index.html`).

Punkt 20 ist ebenfalls erledigt. **Offen: 17 (blockiert), 18, 19, 21, 22.**

**Vor dem Start:** `git status` in **beiden** Ordnern prüfen und über `list_sessions` schauen, ob
gerade eine andere Session in `Local 1.7/` arbeitet. Das Repo wird oft parallel bearbeitet; am
2026-07-26 haben sich zwei Sessions gegenseitig Dateien überschrieben, bis wir Dateien vorher
zugewiesen haben.

---

## Zwei Regeln, die sich durch das ganze Backlog ziehen

**1. Drift läuft in beide Richtungen.** Local ist bei der Input-Härtung (`maxlength`, `min`/`max`,
`Number.isFinite`, teils `Utils.escapeHtml`) durchgehend **voraus**. Niemals blind Web über Local
kopieren. Nach jedem Modul gilt: `diff --strip-trailing-cr Local Web | grep '^>'` darf nur noch
Zeilen zeigen, in denen Web eine Härtung fehlt. Alles andere ist ein unportiertes Feature.

**2. CH/AT bleibt in Local** (Entscheidung D1). Web hat die Schweiz-/Österreich-Teile entfernt,
Local behält sie. Betroffen sind u.a. `euer.js`, `ustvoranmeldung.js`, `oss.js` (Sperrscreens),
`dashboard.js`/`steuertermine.js` (SVS-Kachel, AT-Termine), `companies.js` (Länder-Onboarding),
`app.js` (CH-Settings-Felder, Routing) und `rechnung.js` (MWST-Sätze). Vor jedem Copy prüfen:
`grep -ciE "land === 'CH'|chMwst|schweiz|svs" <datei>`.

## Browser-Test — Cache-Falle

`python -m http.server` schickt keine No-Cache-Header und der Browser-Cache hängt am Origin.
Reload und neuer Tab liefern **alten Code** — man verifiziert sonst versehentlich den
Vorher-Zustand und hält einen ungefixten Bug für gefixt. Bewährt: neuen Eintrag mit **neuem Port**
in `.claude/launch.json` anlegen. 3344–3349 sind vergeben.

Für reine Rechenlogik ist ein Node-Harness schneller und cache-immun: Datei per `vm.runInContext`
laden, `const X = {...}` danach mit `globalThis.X = X;` verfügbar machen, Store per Stub
ersetzen. Beispiele liegen im Scratchpad der Session vom 2026-07-26 (`check-gbr.js`,
`check-afa-kst.js`, `check-wiederkehrend.js`).

---

## Offene Punkte

### ~~16. `eigenbelege/js/app.js` + `js/protokoll.js`~~ — ERLEDIGT 2026-07-27

Die Annahme im Audit war überholt: B6 war bereits synchron. Local löscht Eigenbelege **nicht**
mehr physisch — Storno-Pattern, `storniert`-Flag und `isPeriodLocked`-Prüfung sind vorhanden
(Marker-Counts in Web und Local identisch). `protokoll.js` brauchte keinen Fix: der gesamte
Restdiff ist der Cloud-Anker (`CloudSync.verifyAuditAnchors`), Web-exklusiv nach D2.
Drei Zusatzfunde gefixt — Details im Backlog unter Punkt 16.

**Für Punkt 22 vorgemerkt:** `eigenbelege/index.html` lädt weiterhin `cdn.paddle.com` samt
`Paddle.Initialize(token)`, und `js/user-plan.js` ruft real `Paddle.Checkout.open()`. Paddle gilt
als tot, ist in Local aber noch verdrahtet. Nicht angefasst (Produktentscheidung, `user-plan.js`
steht auf der Ausnahmeliste). Betrifft auch `lager/index.html` und `rechnungen/index.html`.

### 17. `js/lager.js` (Rest) + `lager/index.html` — WEITERHIN BLOCKIERT (Stand 2026-07-27)

`git status` in Web zeigt `js/lager.js`, `lager/index.html` und `lager/page.js` unverändert als
uncommittet — der Refactor läuft noch. Nicht anfangen.

Wartete auf den Web-Lager-Refactor (Section A des Backlogs): Web hat `lager/index.html` als
224-Zeilen-Shell plus `page.js`, Local ist monolithisch mit 2540 Zeilen. **Erst prüfen, ob der
Refactor in Web inzwischen committet ist** — auf unfertigem Stand kein Feld-für-Feld-Diff.
Der Store-Teil von B17 (Kategorien/Status/Zielgruppen/Händler, Storno-Freigabe-Reihenfolge) ist
seit Punkt 1 bereits in Local.

### 18. `js/app.js` — B21, B23, B24

Diagnose-Export, Logo-Upload-Limit 500 KB, differenziertes Backup-Reminder-System,
differenzierte USt-Schwellen-Warnung, Kassenbuch im Finanzen-Sub-Nav, Teilzahlungs-Fix bei den
offenen Posten im Dashboard. Der `app.js`-Diff war beim Audit zu groß für die Detailanalyse —
hier gezielt gegen die Backlog-Punkte prüfen statt pauschal zu kopieren. **Enthält CH-Routing.**

Hinweis: Die Teilzahlungs-Infrastruktur ist seit 2026-07-26 in Local vorhanden
(`Store.addRechTeilzahlung`, `createSaleFromInvoice` mit `opts.teilzahlungBetrag`,
Storno-Kaskade über alle verknüpften Sales) — B21 kann also vollständig portiert werden.

### 19. `js/companies.js` — B29

CSP Phase C: Inline-Handler entfernen. **Achtung:** Local hat laut Section D bereits
`script-src-attr 'none'` in der CSP — die alten Inline-Handler sind dort vermutlich schon jetzt
stillschweigend kaputt. Vor dem Fix im Browser prüfen, ob die betroffenen Buttons überhaupt noch
funktionieren. **Enthält CH-Länder-Onboarding.**

### ~~20. `css/style.css`~~ — D8 ERLEDIGT 2026-07-27

Kontrastwerte, Chart-Höhe, ApexCharts-Legend-Fix, `.mobile-menu-btn` unter 768px und die
WCAG-Touch-Targets sind portiert; `body.stb-readonly` bewusst ausgelassen (kein `stb-share.js`
in Local). **Die Spinner-Behauptung in D8 war falsch** — die Regel hat Web, nicht Local, und sie
macht das Feld auch nicht unbedienbar. Details im Backlog unter Punkt 20.

### 21. B28 — Input-Härtung

Läuft nebenbei mit. Wichtiger ist die **Gegenrichtung**: die Härtungen, die Local hat und Web
fehlen, sollten nach Web nachgezogen werden. Beim bisherigen Durchgang sind sie in `bilanz.js`,
`gbr.js`, `gbr-modul.js`, `vorsteuer.js`, `buchungen.js`, `ausgaben.js`, `afa.js`,
`koerperschaftsteuer.js`, `kassenbuch.js` und `kunden.js` aufgefallen.

### 22. D6 — Datenschutz/Impressum

Eigenständiges Rechtstext-Problem, **nicht** einfach Web kopieren: Web beschreibt
Whop + Vercel Blob + Upstash, Local beschreibt Supabase + LemonSqueezy (tot, verweist auf ein
nicht existierendes `landing.html`). Tatsächlich nutzt Local Trial + Offline-Lizenz
(`js/license.js`). Keine der beiden Fassungen ist korrekt. Mit dem `legal-reviewer`-Agent
angehen.

**Sicherheitsfund nebenbei:** Locals Rechtstext-Seiten haben **gar keinen CSP-Meta-Tag** (Web:
sehr restriktiv `script-src 'none'`). Das sollte unabhängig vom Textinhalt nachgezogen werden.

---

## Nach Abschluss

- Backlog-Datei und Memory `local-sync-backlog-2026-07-25` auf „komplett abgearbeitet" setzen.
- **Commit-Frage mit dem User klären** — Local-Git ist verwaist, der gesamte Sync liegt bewusst
  als Working Copy. Offen ist, ob ein großer oder mehrere thematische Commits sinnvoller sind.
- Separates, noch nicht begonnenes Feature nicht vergessen:
  `plan/session-prompt-local-web-datentransfer.md` (Firmen-Auswahl-Export in Local + Import-Button
  in Web, baut auf `js/backup-crypto.js` auf) — unabhängig von diesem Sync-Backlog.

---

## ~~session-prompt-makecom-webhook.md~~ (committet 4cbd40d, nur Live-Test durch User offen, siehe plan/OFFEN.md §4)

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

---

## ~~session-prompt-offline-grace-stb.md~~ (erledigt, siehe plan/OFFEN.md §6)

Prompt für neue Session (copy-paste):

---

Lies zuerst `plan/spec-offline-grace-stb-readonly.md` — das ist die vollständige Spec für zwei Features, die letzte Session geplant (nicht gebaut) wurden. Setz sie jetzt um, aber erst nachdem die zwei offenen Vorfragen geklärt sind:

**Vorfrage 1 (zuerst klären, blockiert Feature 2):** Lies `js/cloud-sync.js` und `js/backup-crypto.js`. Ist Cloud-Sync echtes E2E mit einem Schlüssel, der aus dem Passwort/Login des Haupt-Nutzers abgeleitet wird (also Server sieht nur Ciphertext), oder ist es nur Transport-verschlüsselt (Server könnte im Klartext lesen)? Sag mir das Ergebnis, bevor du an Feature 2 weiterbaust — das entscheidet, ob ein zweiter Whop-Account (Steuerberater) technisch überhaupt Zugriff auf dieselben Daten bekommen kann.

**Vorfrage 2:** Ich habe mit dem Kunden noch nicht final geklärt, wie genau der Steuerberater-Zugang aussehen soll. Falls ich dir bei Sessionstart noch kein Go dazu gegeben habe: nur Feature 1 (Offline-Grace) umsetzen, Feature 2 (StB-Zugriff) nur als Architektur-Vorschlag ausarbeiten, nicht bauen.

**Feature 1 — Offline-Grace-Modus:**
- Lies `js/whop-auth.js`, finde genau wo/wie oft der Whop-Server-Check aktuell greift.
- Bau einen 4-Stunden-Grace-Cache: einmal online eingeloggt, Access-Flag lokal mit Ablauf-Timestamp speichern, App läuft bis Ablauf ohne erneuten Server-Roundtrip weiter.
- Entscheide selbst (und begründe kurz) was nach Ablauf der 4h passiert, falls weiterhin offline — sinnvoller Default: klare Meldung + Re-Login-Aufforderung sobald wieder online, keine Datenverluste, kein Absturz.
- Prüfe die Konfliktlogik in `js/cloud-sync.js` beim Reconnect: Ich nutze Cloud-Sync auf 2 Geräten teils zeitgleich (Handy im Zug offline + Laptop parallel online). Simples "letzter Schreibvorgang gewinnt" ist NICHT ausreichend. Wenn noch keine Konflikterkennung existiert, bau eine (Zeitstempel-Vergleich pro Datensatz, bei Kollision Nutzer warnen statt still überschreiben).
- Verifiziere im Browser (preview_*-Tools): Login, Netz simulieren/trennen, App bleibt nutzbar, Reconnect synct sauber.

**Feature 2 — Steuerberater Read-Only (nur falls Vorfrage 1 technisch machbar UND Go vom User da ist):**
- Zweiter Whop-Account bekommt Read-Only-Rolle auf denselben Datenbestand, vollen Funktionsumfang sichtbar, alle Schreib-Aktionen/Buttons ausgeblendet.
- Kläre selbst den einfachsten Weg, StB-Account mit genau einem Mandanten zu verknüpfen (z. B. Einladungs-Flow) — halte es so schlank wie möglich, kein Overengineering für hypothetische Multi-Mandanten-Fälle.

Danach: Memory aktualisieren mit dem, was gebaut wurde und was (falls Feature 2 verschoben) noch offen ist.

---

**Modell-Empfehlung:** **Opus 4.8**, nicht Sonnet. Grund: Vorfrage 1 ist eine Architektur-/Security-Entscheidung (E2E-Krypto-Analyse an Finanzdaten eines Steuerberaters), die Konfliktlogik bei parallelem Multi-Device-Edit ist fehleranfällig wenn zu leichtfertig gebaut, und beide Features hängen an mehreren Dateien (whop-auth.js, cloud-sync.js, backup-crypto.js) gleichzeitig. Das ist die Art Aufgabe, bei der Opus' gründlicheres Reasoning den Unterschied macht — Sonnet 5 reicht danach locker für die Nacharbeiten/Politur in Folge-Sessions.

---

## ~~session-prompt-onboarding-rebuild.md~~ (Firmenname-Label committet 4949b31, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste)

---

Kontext: Onboarding wird neu gebaut. Ist-Zustand + alle Design-Entscheidungen sind
mit dem User bereits Position für Position durchgesprochen (siehe unten). Noch NICHTS
implementiert — nur geplant. Bau jetzt den kompletten neuen Flow.

## Ist-Zustand (2 Onboardings hintereinander)

- **A) Firma-Screen** — `js/companies.js` (`showOnboarding`, ab Zeile ~680, Aktionen
  `co-select-land`/`co-submit-onboarding` ab Zeile ~900): Land (DE/AT/CH), Firmenname,
  Branche, Erkennungsfarbe → "🚀 Starten".
- **B) Stammdaten-Wizard** — `js/app.js` (`_showOnboarding`/`_renderOnboarding`/
  `_saveOnboardingStep`/`_finishOnboarding`/`_skipOnboarding`, ab Zeile ~1220), 5–6 Steps
  je nach Land (`isCH` an Zeile 1269 verzweigt in Kanton/Gemeinde/GJ + AHV/MWST):
  1. Firmenname + Ansprechpartner-Name
  2. Adresse/PLZ/Ort
  3. Telefon/Email
  4. Steuernummer/USt-ID/USt-Modus (Karten-UI `ust-picker`, DE) bzw. AHV/MWST-Nr/MWST-Modus (CH)
  5. (nur CH) Kanton/Gemeinde/Geschäftsjahr-Start
  5/6. Bankname/IBAN/BIC
  Plus Sprachwahl davor (`_showLangPicker`, Zeile ~1228) und Skip-Link auf Step 1
  ("Ich habe schon eine Firma — Setup überspringen", erst am 2026-07-15 gefixt, Commit
  `6527bcc` — ustMode-Default-Bug beim Skip).

## Entschiedener Ziel-Flow (User hat jede Position einzeln bestätigt)

Nur noch **1 Wizard, 5 Steps, DE-only** (kein Land-Picker — deckt sich mit
[Launch-Woche-Todo](launch-woche-2026-07-13.md) "CH/AT raus aus Web"; ganzer
`isCH`-Zweig in app.js kann komplett weg):

1. **Firma**: Firmenname, Ansprechpartner-Name, Branche (Dropdown, behalten) —
   Erkennungsfarbe NICHT mehr abfragen, stattdessen automatisch zufällig vergeben
   (später in Firmen-Einstellungen änderbar). Skip-Link bleibt hier.
2. **Adresse**: Adresse/PLZ/Ort (eigener Step, NICHT mit Kontakt zusammenlegen — User
   wollte Steps getrennt lassen)
3. **Kontakt**: Telefon (optional, kein `required`), Email
4. **Steuer**: Steuernummer + USt-ID (beide behalten, beide optional) + USt-Modus als
   Karten-UI wie bisher (Klein-/Regelbesteuerung mit Gesetzes-Fakten) — User will hier
   explizit KEINE Vereinfachung zu Radio/Toggle
5. **Bank**: Bankname/IBAN/BIC (optional), letzter Step

companies.js-Screen (Land/Firmenname/Branche/Farbe) verschmilzt komplett in Step 1 des
app.js-Wizards. Kein zweiter Onboarding-Screen mehr davor — Firma wird direkt beim
`_finishOnboarding` bzw. äquivalent angelegt (`CompanyManager`-Firma-Erstellung in
Step-1-Submit einbauen statt als eigenen vorgeschalteten Screen).

## Umsetzung

- `js/app.js`: `isCH`-Verzweigung raus (Zeilen ~1269, 1412–1438 Kanton/Gemeinde/GJ-Step,
  CH-Zweig in Step 4 Zeile ~1329–1369). `totalSteps` fix auf 5. Step 1 um Branche-Feld
  erweitern (Optionsliste aus `CompanyManager.BRANCHEN`, siehe companies.js Zeile ~687),
  Farbe automatisch (Zufallsfarbe aus vorhandener Farbpalette, siehe companies.js
  `farbenHtml`-Quelle).
- `js/companies.js`: `showOnboarding()` (Zeile ~680) + `_selectLand`/`_selectLandBtn`
  (Land-Auswahl) können weg oder zumindest nicht mehr im User-Flow aufgerufen werden —
  prüfen, ob `_showOnboarding` in app.js diesen Screen noch VOR dem Wizard aufruft; falls
  ja, den Aufruf entfernen und Firmenanlage direkt in `_finishOnboarding` (app.js)
  einbauen (CompanyManager-Firma mit Land fix `'DE'` erzeugen).
- `_skipOnboarding` (app.js Zeile ~1514) unverändert lassen (Bug ist schon gefixt,
  ustMode-Default bleibt wie in Commit `6527bcc`).
- Sprachwahl (`_showLangPicker`) bleibt unverändert davor — war nicht Teil der Fragen,
  nicht anfassen.

## Verifizieren

Browser-Preview: `localStorage.clear()` simulieren (oder frisches Profil), kompletten
Flow durchklicken (Firma → Adresse → Kontakt → Steuer → Bank → Finish), prüfen dass:
- Firma wird mit Land `'DE'` angelegt, Branche korrekt übernommen, Farbe zufällig gesetzt
- Skip-Link auf Step 1 funktioniert weiterhin (ustMode-Default korrekt)
- Kein toter Code-Pfad für CH mehr erreichbar über den normalen Onboarding-Flow
  (CH bleibt ggf. in Local 1.7 bestehen — NUR Web 1.7 betreffen laut Launch-Woche-Todo)

Nach Fertigstellung: Memory `onboarding-skip-existing-company.md` und
`launch-woche-2026-07-13.md` aktualisieren falls die dortigen Onboarding-Punkte damit
erledigt sind.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Klar spezifizierte UI-Umbau-Aufgabe in bekannten
Dateien (app.js Onboarding-Funktionen, companies.js Onboarding-Screen), keine
unklare Architektur-Entscheidung mehr offen — alle Positionen sind vom User bereits
einzeln abgenickt. Reines Ausführen + Browser-Verifikation.

---

## ~~session-prompt-performance-a11y.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — P2-2: Performance + Accessibility Audit

---

Kontext: Stackr ist eine lokal-first Buchhaltungs-App (kein Backend-Rendering, alles
Vanilla-JS + localStorage/IndexedDB). Vor breiterem Nutzerwachstum: Performance- und
A11y-Check auf Landing (`index.html`) UND App (`app.html` + Unterseiten), nicht nur
Landing — die App-Seiten sind deutlich schwerer.

Zentrale Dateien/Fakten aus dieser Recherche (2026-07-16), als Startpunkt, nicht als
vollständiger Befund:
- `js/app.js` (2938 Zeilen) + `js/store.js` (2868 Zeilen) sind die mit Abstand größten
  Bundles, ungebündelt/ungecompressed als einzelne `<script>`-Tags eingebunden.
- `app.html` lädt mehrere CDN-Ressourcen (`cdn.jsdelivr.net`: Tabler-Icons-Webfont,
  Notyf, Flatpickr, GSAP) — mit `preconnect`/`dns-prefetch` und SRI (`integrity=`)
  bereits vorbereitet, ApexCharts wird laut `js/dashboard.js` lazy nachgeladen
  (`_ensureApexCharts()`) statt beim Boot — guter Ansatz, prüfen ob konsequent überall so.
- Landing (`index.html`) hat KEINE `<img>`-Tags (rein CSS/SVG-basiert), self-hosted
  variable Fonts mit `preload` (`fonts/inter-var-latin.woff2`,
  `fonts/fraunces-var-latin.woff2`) — solide Basis, hier eher Feinschliff.
- `:focus-visible` ist in `css/style.css` (~Zeile 996) definiert — kein Skip-Link
  gefunden (`grep -n "skip-link"` liefert nichts in `index.html`/`css/style.css`).
- 14 Treffer für `aria-`/`alt=` auf `index.html` — Umfang nicht geprüft, ob ausreichend.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## 1. Performance — Landing (`index.html`)

- Lighthouse/PageSpeed-Messung im Preview (Performance-Score, LCP, CLS, INP als
  Baseline-Zahlen dokumentieren — P1-3 "Launch-Baseline messen" braucht die evtl. auch).
- Font-Loading gegenchecken: `font-display` korrekt gesetzt? Preload wirklich nur die
  tatsächlich above-the-fold genutzten Gewichte?
- Falls `landing-v2.html`/`deploy/*.html` (siehe `session-prompt-landing-seo.md`) noch
  relevant sind, dort denselben Check.

## 2. Performance — App (`app.html` + Module)

- Bundle-Größe: `js/app.js`/`js/store.js` real ausgeliefertes Gewicht messen (nicht nur
  Zeilenzahl). Prüfen ob Code-Splitting (z. B. GbR/Schweiz-Restmodule, Steuerberater-Modus)
  sinnvoll ohne größeren Umbau möglich ist, oder ob das YAGNI ist für eine App dieser
  Größe — nicht vorschnell ein Bundler-Setup einführen, wenn die App bewusst
  bundlerlos/Vanilla ist (Architekturentscheidung respektieren, siehe `vergleich-technisch`).
- CDN-Skripte in `app.html`: welche sind wirklich beim Boot nötig vs. lazy-ladbar wie
  ApexCharts? `defer`/`async` durchgehend korrekt gesetzt?
- LocalStorage/IndexedDB-Zugriffsmuster bei großen Datenmengen (viele Rechnungen/Belege)
  — gibt es synchrone Vollscans, die bei wachsenden Datenmengen spürbar würden? Stichprobe
  in `js/store.js`, nicht jede Funktion einzeln.
- Chart-Rendering (`js/dashboard.js`, ApexCharts): Re-Render-Häufigkeit prüfen (Memory
  `csp-haertung-fortschritt.md`/aktueller Commit `252c1cd` hat hier schon
  Legend/Jahresvergleich-Rerender gefixt — verifizieren ob noch weitere unnötige
  Re-Renders bestehen, nicht denselben Fix nochmal machen).

## 3. Accessibility — Landing

- Skip-Link zum Hauptinhalt ergänzen (aktuell keiner vorhanden).
- Kontrastprüfung (WCAG AA, 4.5:1 Normaltext / 3:1 Großtext) für das Dark+Emerald-Design
  (`stackr-ui-v2-design-brief` in Memory) — besonders Sekundärtext/Muted-Farben.
- Tastaturnavigation: alle interaktiven Elemente (CTA-Buttons, FAQ-Akkordeon falls
  vorhanden, Trial-Links) ohne Maus erreichbar + sichtbarer Fokus-Indikator.
- Formular-Labels (Login/Signup-Flow falls auf Landing vorhanden) korrekt mit `<label>`
  oder `aria-label` verknüpft.

## 4. Accessibility — App

- Screenreader-Tauglichkeit der Kernflows (Rechnung anlegen, Beleg erfassen) — Fokus auf
  die Formulare, nicht die komplette App auf einmal.
- Farbcodierte Status (bezahlt/offen/überfällig, GoBD festgeschrieben/offen) — zusätzlich
  zur Farbe auch Text/Icon vorhanden (nicht nur Farbe als einziges Signal)?
- Touch-Targets auf Mobile (≥44×44px) für Tabellen-Aktionen (siehe kürzlich gefixtes
  Warenpositionen-Scroll-Problem bei Eigenbelegen, Commit `ca6469f` — ähnliches Muster
  an anderen Tabellen prüfen).

## Abschluss

- Zahlen (Lighthouse-Scores, Bundle-Größen) VOR und ggf. NACH Fixes dokumentieren.
- Nur klar korrekte, risikoarme Fixes selbst umsetzen (Skip-Link, `font-display`,
  fehlende `aria-label`); bei größeren Architekturfragen (Code-Splitting, Bundler)
  nur dokumentieren + Empfehlung geben, nicht ungefragt umbauen.
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P2-2 nachtragen.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Audit + viele kleine, gut abgrenzbare Fixes über
mehrere Dateien, aber ohne tiefe Business-Logik-Verzahnung wie bei den USt-/Whop-Themen —
Opus wäre hier over-provisioned.

---

## ~~session-prompt-persona-cta-touch-target.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Touch-Target-Fix `.persona-cta`

Vor dem Start: `/caveman` und `/ponytail` aktivieren. Ist ein Ein-Zeilen-CSS-Fix,
kein Grund für lange Erklärtexte oder neue Abstraktionen — kleinster Diff der
funktioniert.

---

Kontext: Auf der Stackr-Landing (`index.html`, Sektion "Für wen?") gibt es drei
Buttons mit Klasse `.persona-cta` ("Als Freelancer starten →", "Als GbR starten →",
"Als Reseller starten →"). Live bei 375px Viewport gemessen (`getBoundingClientRect()`):
Klickfläche nur ~278×17.6px (`padding: 0`, `display: block`, reiner Text-Link-Stil).
Das unterschreitet WCAG 2.5.8 AA (min. 24×24 CSS-px), von 44×44px AAA-Touch-Targets
ganz zu schweigen. Gefunden 2026-07-19, noch nicht gefixt (Stand 2026-07-21 verifiziert:
`css/landing.css:673` hat weiterhin `padding: 0`).

WICHTIG (geteiltes Repo): Vor JEDEM Edit `git status`/`git diff -- css/landing.css`
frisch prüfen — evtl. läuft eine Parallel-Session im selben Ordner an derselben
Datei. Nur den `.persona-cta`-Block anfassen, Rest unangetastet lassen.

## Fix

`css/landing.css` Zeile ~673, Regel `.persona-cta`:

```css
.persona-cta {
    background: none; border: none; padding: 0; cursor: pointer;
    color: var(--accent); font-size: 13.5px; font-weight: 600; font-family: var(--font-sans);
    text-align: left; transition: opacity .15s;
}
```

Genug vertikales Padding ergänzen, damit die Klickfläche auf ≥44px Höhe kommt
(z. B. `padding: 12px 0` oder `min-height: 44px` + `display: flex; align-items: center;`),
ohne das Text-Link-Design optisch zu verändern (kein Button-Hintergrund, keine
Border — nur die Hitbox wächst).

## Verifizieren

- Browser-Preview auf 375px Breite resizen (`.claude/launch.json` → `stackr`,
  Port 3333).
- Per `javascript_tool`/Konsole: `document.querySelectorAll('.persona-cta')` →
  `getBoundingClientRect().height` für alle drei Links ≥ 44 (oder mind. ≥ 24, wenn
  44 das Layout sichtbar sprengt — dann kurz begründen warum).
- Sichtprüfung: Text-Link-Optik bleibt wie vorher, nur größere Klickfläche.

## Abschluss

- `plan/todo-rest-2026-07-19.md` Eintrag zu `.persona-cta` als erledigt markieren.
- Kleiner, fokussierter Commit reicht.
- Nicht deployen — macht der User.

---

**Modell-Empfehlung: Haiku 4.5 oder Sonnet 5.** Reiner CSS-Fix, keine Logik, keine
Sicherheitsrelevanz — kein Fall für Opus-Reasoning.

---

## ~~session-prompt-rechnung-eigenbeleg-vollaudit-2026-07-23.md~~ (alle 29 Funde abgearbeitet, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Vollaudit Rechnungen + Eigenbelege: Lücken-Sweep über alle Dimensionen

---

Kontext: Am 2026-07-23 bereits ein reiner **GoBD/Steuerrecht**-Audit über `rechnungen/js/*` und
`eigenbelege/js/app.js` gelaufen (`legal-reviewer` + `general-purpose`, Ergebnis in
`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`) — noch NICHT gefixt. Diese Datei
erweitert den Scope auf **alle** Arten von Lücken (nicht nur Steuerrecht): Rechenfehler, Security,
Feature-Vollständigkeit, UX, Accessibility, Datenschutz, UI-Bugs, Datenintegrität. Reine
Planung — vor Ausführung `git status --short` + `git log --oneline -10` prüfen (parallele
Sessions im selben Ordner üblich, siehe GoBD-Plan-Datei).

Jede Dimension unten nennt das richtige Werkzeug (Skill via `Skill`-Tool oder Agent via
`Agent`-Tool mit `subagent_type`), den Datei-Scope und Leitfragen, damit die Agenten nicht generisch
antworten, sondern konkret auf Rechnungen/Eigenbelege zielen. Dimensionen 2, 3, 6, 7, 8, 9 sind rein
lesend und unabhängig voneinander → können als **ein Agent-Batch parallel** gestartet werden
(mehrere `Agent`-Aufrufe in derselben Response). Dimension 4+5 sind eher strategisch, danach separat.
Dimension 1 ist bereits erledigt und nur verlinkt, nicht erneut laufen lassen.

## 1. GoBD/Steuerrecht — bereits erledigt, nur verlinken

Ergebnis + Fix-Plan: `plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`. Nicht erneut
auditieren, aber vor den anderen Dimensionen kurz gegenlesen (Audit-Log-Lücke bei Eigenbelegen
betrifft ggf. auch Dimension 9 Datenintegrität).

## Status (2026-07-23) — alle 8 Dimensionen (2-9) durchgelaufen

Priorisierte Top-Funde über alle Dimensionen (Details je unten unter Dimension):

- 🔴 **KRITISCH** Dim3: `rechnungen/js/wiederkehrend.js:50/55` — Key `rech_recurring_rules` nicht company-präfixiert → Mandanten-Datenleck + falsche Rechnungserstellung/Nummernkreis bei Multi-Firmen-Nutzern.
- 🔴 **HOCH** Dim2: `wiederkehrend.js:9-21` `addInterval()` — Monatsend-Rollover-Bug (31.1. → 3.3. statt 28.2., bleibt dauerhaft verschoben).
- 🔴 **HOCH** Dim2: `mahnungen.js` — Verzugszinsen §288 BGB fehlen komplett (nur Fixgebühren).
- 🟠 **HOCH** Dim3: `eigenbelege/js/app.js:1209,1477` — `zahlungswegSonstig` ungeschützt (XSS), Copy-Paste-Fehler ggü. sonst konsequentem Escaping.
- 🟠 Dim8: `eigenbelege/js/app.js:1735` `alleLoeschen()` — kein `isBelegGesperrt()`-Check, Bulk-Löschen killt GoBD-gesperrte Belege (§147 AO).
- 🟠 Dim9: Eigenbeleg-Import (`js/store.js:2450-2461`) löscht Keys vor Restore nicht → Datenmix zwischen Firmen möglich.
- 🟡 Dim4: Teilzahlung/Ratenzahlung fehlt komplett im Rechnungsmodul.
- 🟡 Dim6: Modals in beiden Sub-Apps ohne Fokus-Trap/ARIA/ESC (Haupt-App hat's, Sub-Apps nicht nachgezogen); Labels systemweit ohne `for`/`id`.
- 🟡 Dim7: `eigenbelege/index.html` lädt `cookie-banner.js` nicht → Consent-Banner fehlt bei Direktaufruf; alter Marken-Text "Reselling Tool" in AGB-Modal-Duplikat.
- 🟡 Dim5: Versand-Status manuell statt automatisch; Mahnungen-„bezahlt" umgeht Lager-Sync-Modal.
- 🟡 Dim2: Fälligkeitsdatum wird auch bei Lieferdatum-Modus gesetzt → false-positive „überfällig".
- 🟢 Dim2: Rundungs-Inkonsistenz Positionssumme vs. Gesamtsumme (Cent-Ebene, GoBD-Belegkonsistenz).
- 🟢 Dim4: Angebot→Rechnung keine 1-Klick-Konvertierung; keine Vor-Fälligkeits-Erinnerung.
- Sonstige Einzelfunde (niedrig): Touch-Targets <44px bei `.btn`/`.btn-sm`, Kontrast `--text-muted` 4.25:1, Tabellen ohne `scope`, doppelter Mobile-Menü-Button in Rechnungen, PDF-Seitenumbruch ungesichert, unescapte Menge im Eigenbeleg-Druck, Fail-Open Whop-Gate bei AuthUI-Ladefehler.

Noch nicht gefixt — nächster Schritt: Fix-Reihenfolge nach Schweregrad (kritisch/hoch zuerst), dann Fix-Plan-Datei analog GoBD-Plan anlegen falls gewünscht.

## 2. Korrektheit/Rechenfehler

**Werkzeug:** `Agent` mit `subagent_type: fn-checker`.

**Scope:** `rechnungen/js/rechnung.js` (Rechnungssumme/Steuerberechnung/Rundung), `rechnungen/js/mahnungen.js`
(Fristenberechnung), `rechnungen/js/wiederkehrend.js` (Intervall-/Datumslogik), `eigenbelege/js/app.js`
(MwSt-Berechnung, Nummernvergabe).

**Leitfragen:** Rundungsfehler bei Netto→Brutto-Umrechnung pro Position vs. Summenbildung
(Cent-Abweichung durch Rundung je Zeile statt am Ende)? Verzugszinsen-Formel in `mahnungen.js`
korrekt (Basiszinssatz + 9 Prozentpunkte B2B / 5 Prozentpunkte B2C, §288 BGB)? Mahnfristen-
Berechnung inkl. Wochenenden/Feiertage oder nur Kalendertage? Wiederkehrende Rechnung an
Monatsenden (29./30./31., Schaltjahr-Februar) — überspringt/verschiebt sie korrekt? Storno-
Rechnung: negative Positionen korrekt gegen Original gerechnet, keine Rundungsdifferenz zwischen
Original und Storno?

**Ergebnis (2026-07-23, fn-checker):**
1. 🟢 Rundungsfehler bestätigt: `rechnung.js:541-548`/`1203-1219` — Positionssumme wird ungerundet akkumuliert, Zeilen aber einzeln gerundet angezeigt → Cent-Abweichung möglich bei Bruchteil-Cent-Werten.
2. 🔴 HOCH: Verzugszinsen §288 BGB fehlen komplett in `mahnungen.js` — nur manuelle Fixgebühren (0/5/10€), kein Zinssatz. Entgangener gesetzlicher Anspruch.
3. 🟡 Mahnfristen (14/10/7 Tage) sind hartcodierte Textstrings, keine echte Berechnung. Zusatzfund: `#invFaelligkeit` wird auch bei `datumsOption='lieferdatum'/'lieferzeitraum'` gespeichert/geprüft → false-positive „überfällig" in `mahnungen.js:49`.
4. 🔴 HOCH: `wiederkehrend.js:9-21` `addInterval()` — `setMonth`/`setFullYear` ohne Clamping. 31.1. monatlich → springt auf 3.3. statt 28.2., bleibt danach dauerhaft verschoben. Gleicher Bug bei jährlich + Schaltjahr (29.2. → 1.3., fixiert). Betrifft Miet-/Abo-Regeln.
5. 🟢 Storno: reine Vorzeichen-Negation, keine Rundungsdifferenz. Risiko (nicht verifiziert): bei §25a-Positionen bleibt `einkaufspreis` positiv während `einzelpreis` negativ wird → mögliche falsche Marge in nachgelagerter Berechnung.

## 3. Security

**Werkzeug:** `Skill` mit `skill: security-stackr`.

**Scope:** `rechnungen/index.html`, `eigenbelege/index.html` (Whop-Gate-Wiring — Regressionscheck
seit Fix `[[whop-gate-standalone-pages]]` 2026-07-04), alle `innerHTML`-Stellen in
`rechnungen/js/*` und `eigenbelege/js/app.js` mit Kunden-/Belegtext-Interpolation (XSS via
Kundenname, Notizfeld, Rechnungsposition-Freitext), PDF-Generierung (Injection über Freitext in
generierte PDF-Inhalte?), localStorage-Company-Scoping erneut (Regression seit
`[[eigenbeleg-company-scoping]]`-Fix, v.a. wenn seither neue Felder/Keys hinzugekommen sind).

**Ergebnis (2026-07-23, security-stackr):**
1. 🟡 Whop-Gate intakt (`AuthUI.boot()` in beiden Standalone-Seiten), aber Fail-Open falls `AuthUI` undefiniert (Script-Ladefehler) → Gate entfällt komplett. Fix ~15 Min.
2. 🟠 HOCH XSS: `eigenbelege/js/app.js:1209` (Detail-Modal) + `:1477` (PDF-Druck) — `zahlungswegSonstig` ungeschützt interpoliert, während dieselbe Variable in der Liste (`:1112`) korrekt escaped ist. Aktuell kein UI-Eingabepfad, aber bei Backup-Import/Cloud-Sync-Import fremder JSON-Daten ausnutzbar (Payload läuft im App-Kontext, Zugriff auf localStorage/Whop-Token). Fix ~5 Min.
3. 🟢 PDF-Generierung sonst durchgängig escaped (Rechnung, Eigenbeleg, E-Rechnung-Import).
4. 🔴 KRITISCH: `rechnungen/js/wiederkehrend.js:50/55` — Key `rech_recurring_rules` NICHT company-präfixiert (im Gegensatz zu allen Eigenbeleg-Keys). Folgen: (a) Mandanten-Datenleck — Firma B sieht Regeln/Beträge/Positionen von Firma A; (b) `processDueRules()` läuft bei jedem Boot über ALLE Regeln unabhängig von aktiver Firma → wiederkehrende Rechnung kann unter falscher Firma mit falschem Nummernkreis/USt-Zuordnung erzeugt werden. Gleicher Bugtyp wie der 2024 gefixte `oyi_eb_migrated_v1`-Fall, hier nie behoben. Fix ~1-2h inkl. Migration.

## 4. Feature-Vollständigkeit vs. Konkurrenz

**Werkzeug:** `Skill` mit `skill: vergleich-buchhaltung`, ergänzend `Skill` mit `skill: feature-gap`.

**Scope:** Rechnungsmodul komplett (Mahnwesen, wiederkehrende Rechnungen, E-Rechnung sind schon
da). Leitfragen: Teilzahlungen/Ratenzahlung auf eine Rechnung abbildbar? Rechnungs-Layout/Branding
anpassbar (Logo, Farbe)? Angebot→Rechnung-Konvertierung vorhanden? Automatisierte
Zahlungserinnerung vor Fälligkeit (nicht nur Mahnung danach)?

**Ergebnis (2026-07-23, vergleich-buchhaltung + feature-gap):**
1. 🔴 KRITISCH: Teilzahlung/Ratenzahlung fehlt komplett — Status-Enum kennt nur offen/bezahlt/ueberfaellig/storniert, kein `teilbezahlt`, kein Teilbetrag-Feld. sevDesk bildet das explizit ab.
2. 🟢 Branding (Logo+Farben) bereits vorhanden (`unternehmensdaten.js:178-231`) — kein Handlungsbedarf, ursprüngliche Annahme falsch.
3. 🟠 Angebot→Rechnung: kein 1-Klick-Konvertierung, Nutzer muss Rechnung komplett neu anlegen trotz eigenständigem Angebots-Modul.
4. 🟡 Keine Vor-Fälligkeits-Erinnerung (nur Mahnwesen nach Fälligkeit) — aber auch bei Konkurrenz kein Kernstandard, geringerer Druck.
Priorisierung: Teilzahlung → Angebot-Konvertierung → Vor-Fälligkeits-Erinnerung → Branding (erledigt).

## 5. UX/Journey

**Werkzeug:** `Skill` mit `skill: ux-journey`.

**Scope:** Flow „Rechnung erstellen" (Kunde anlegen → Position hinzufügen → Versand/Status),
Flow „Eigenbeleg erfassen", Mahnwesen-Flow. Leitfragen: fehlende Empty-States, unklare
Fehlermeldungen, zu viele Klicks für Standardfall (Rechnung an Bestandskunde).

**Ergebnis (2026-07-23, ux-journey):**
1. Versand-Status wird nicht automatisch gesetzt — separate Checkbox nach PDF/E-Mail-Öffnen, leicht vergessen (`dokumente.js:362-398`).
2. Mahnungen-„Als bezahlt" (`.mahn-paid`, `mahnungen.js:321-333`) umgeht das Lager-/Verkaufs-Sync-Modal (`showBezahltModal`), das der reguläre Dokumente-Bezahlt-Pfad nutzt — Inkonsistenz, Lagerartikel-Sync fehlt bei aus Mahnungen bezahlten Rechnungen.
3. Kunden-Dropdown reines `<select>` ohne Suche (`kunden.js:134-140`) — mühsam bei vielen Bestandskunden.
4. Kein "Rechnung duplizieren"/"letzte Rechnung an Kunden kopieren".
5. Eigenbeleg-Empty-State vorbildlich (Icon+Button); Rechnungen/Kunden-Empty-States nur Text ohne CTA.
6. Eigenbeleg-Formularvalidierung inkonsistent: nativer HTML5-Popup-Stil bricht optisches Muster (nur ein Fehler nutzt App-Toast).

## 6. Accessibility

**Werkzeug:** `Skill` mit `skill: accessibility`.

**Scope:** `rechnungen/index.html`, `eigenbelege/index.html` — Formulare, Tabellen, Modal-
Fokus-Trap, Farbkontraste, Touch-Targets (siehe `[[feedback-browser-edge]]`/frühere
Touch-Target-Fixes als Referenzmuster).

**Ergebnis (2026-07-23, accessibility):**
1. 🟠 HOCH: Labels systemweit ohne `for`/`id`-Verknüpfung (33× eigenbelege, 97× rechnungen) — WCAG 1.3.1/3.3.2, Screenreader-Fokus kaputt.
2. 🟠 HOCH: Modals ohne `role="dialog"`/`aria-modal`/Fokus-Trap/ESC in beiden Sub-Apps (`eigenbelege/js/app.js:1754`, `rechnungen/js/app.js:124-150`) — Haupt-App-Modal hat's bereits korrekt, Sub-Apps nicht nachgezogen. WCAG 2.4.3/4.1.2.
3. 🟡 Icon-Button ohne `aria-label` (nur `title`) — "Filter zurücksetzen" (`eigenbelege/js/app.js:1053`).
4. 🟡 Touch-Targets <44px bei `.btn`/`.btn-sm` mobile (`css/style.css:2540`, 858-870) — `.btn-icon`/`.btn-small` sind bereits korrekt, Basis-Buttons nicht.
5. 🟡 Tabellen ohne `scope="col"` (`kunden.js`, `dokumente.js`, `mahnungen.js`, `produkte.js`, `rechnung.js`).
6. 🟡 Kontrast `--text-muted` (#71807a) auf `--bg-card` ≈4.25:1, unter AA-Minimum 4.5:1 — betrifft Footer-Links Impressum/Datenschutz.

## 7. UI-Bugs

**Werkzeug:** `Skill` mit `skill: ui-checker`.

**Scope:** Beide Module inkl. aller Sub-Tabs (Dashboard, Kunden, Produkte, Mahnungen,
Wiederkehrend, Protokoll, Unternehmensdaten).

**Ergebnis (2026-07-23, ui-checker):**
1. 🟠 Recht/Branding: `rechnungen/js/app.js:184` — separater AGB-Modal-Text nennt noch alte Marke "Reselling Tool/Rechnungsbuch", schwächer als aktuelles AGB (`js/app.js:824`, fehlt §7/§8). 2 divergierende AGB-Versionen im Produkt = Compliance-Risiko.
2. 🟠 DSGVO: `eigenbelege/index.html` lädt `cookie-banner.js` gar nicht (rechnungen/index.html schon) → Consent-Banner fehlt bei Direktaufruf von /eigenbelege/.
3. 🟡 Doppelter Mobile-Menü-Button in Rechnungen (`#mobileMenuBtn` Legacy-Handler läuft parallel zum globalen Sidebar-Toggle) — eigenbelege hat nur den globalen Toggle.
4. 🟢 Stat-Card-Animation inkonsistent (Eigenbelege GSAP-Countup, Rechnungen statisch) — kosmetisch.
5. 🟢 Script-Ladereihenfolge page-shell.js vs. app.js zwischen Modulen vertauscht — aktuell unschädlich, Risiko bei künftigen Änderungen.
6. ✅ Whop-Gate + CSP korrekt in beiden Modulen; Kunden/Produkte sauber.

## 8. Datenschutz

**Werkzeug:** `Skill` mit `skill: datenschutz`.

**Scope:** Kundendaten in Rechnungen (Name/Adresse/E-Mail), Aufbewahrungspflicht (10 Jahre, §147
AO) vs. DSGVO-Löschpflicht-Konflikt (Aufbewahrungspflicht hat Vorrang — wird das im Code/den
Texten sauber dargestellt?), Übertragung von Rechnungs-/Eigenbelegdaten über Cloud-Sync
(`[[cloud-sync-backend]]`).

**Ergebnis (2026-07-23, datenschutz):**
1. ❌ Verstoß §147 AO/GoBD: `eigenbelege/js/app.js:1735-1742` `alleLoeschen()` prüft `isBelegGesperrt()` NICHT (Einzel-Löschung `deleteBeleg:1261-1271` macht's korrekt) → Bulk-Löschen vernichtet auch GoBD-gesperrte Belege innerhalb der 10-Jahres-Frist unwiderruflich.
2. ✅ Rechnungen unveränderbar (kein Lösch-Button, nur Storno), Kundenlöschung respektiert Aufbewahrungspflicht (Soft-Delete bei bestehenden Rechnungen), Kundendaten-Ausgabe konsequent escaped, Cloud-Sync E2E-verschlüsselt (Server sieht nur Chiffrat).
3. ⚠️ Nebenbefund (nicht Kernscope): CDN-Laden von ApexCharts/Notyf/Flatpickr/Tabler-Icons → IP-Übertragung an Drittanbieter, SRI vorhanden aber kein Self-Hosting.

## 9. QA/Datenintegrität

**Werkzeug:** `Skill` mit `skill: qa`.

**Scope:** Export/Import Rechnungen+Eigenbelege (Vorarbeit siehe GoBD-Plan Fund 1+2 zu
fehlendem Audit-Log), Edge Cases: 0€-Rechnung, negative/Null-Menge, Sonderzeichen in
Kundennamen bei PDF-Export, sehr lange Positionslisten (Seitenumbruch im PDF).

**Ergebnis (2026-07-23, qa):**
1. 🟡 `js/store.js:2450-2461` `importAll` — Eigenbeleg-Keys werden beim Restore nur überschrieben, NICHT vorher gelöscht (im Gegensatz zu Hauptdaten, die bewusst "Datenmix" verhindern). Zusätzlich lässt `exportAll` leere Eigenbeleg-Keys weg. Import von Firma-B-Backup in Firma A kann inkonsistenten Mischzustand erzeugen (Belege referenzieren nicht-existente Produkte).
2. 🟡 `rechnungen/js/rechnung.js:516` — Position mit leerer Beschreibung UND 0€-Preis wird beim Speichern still verworfen, keine Warnung (Guard greift nur wenn ALLE Positionen leer sind).
3. 🟢 PDF-Seitenumbruch ungesichert (kein `page-break-inside:avoid`), Kopfbereich wiederholt sich nicht auf Folgeseiten.
4. 🟢 Unescapte Mengenangabe im Eigenbeleg-Druck (`app.js:1343,1177`) — UI-seitig durch `type="number"` entschärft, aber nicht clientseitig abgesichert bei Import-Schreibpfaden.
5. ✅ Sonderzeichen in Kundennamen: unkritisch, durchgängig escaped.

## Ausführungshinweis

Nicht automatisch alle 8 Werkzeuge gleichzeitig ohne Rücksprache starten — das ist ein großer
Kontext-/Kosten-Block. Reihenfolge-Vorschlag beim Start dieser Session: zuerst 2+3 (Korrektheit +
Security, größtes Risiko), dann 6+7+8+9 als zweiter Parallel-Batch, 4+5 (strategisch) zuletzt und
nur falls gewünscht. Ergebnisse pro Dimension in dieser Datei unter der jeweiligen Überschrift
mit Datum ergänzen, damit der Fortschritt sichtbar bleibt (wie bei den anderen
`session-prompt-*`-Dateien mit Status-Abschnitt).

---

## ~~session-prompt-stb-gate-revoke.md~~ (erledigt, Revoke-Logik in js/stb-share.js, siehe plan/OFFEN.md §6)

Prompt für neue Session (copy-paste):

---

Kontext: Feature "Steuerberater Read-Only" (Envelope-Key, ECDH P-256) ist auf **master**
bereits vollständig gebaut: Krypto-Kern + Client-Flows (`js/stb-share.js`), Server-Endpoints
`register_pubkey/get_pubkey/grant/revoke/list_grants` (`api/sync.js`), Read-Only-UI-Sperre
(`.stb-readonly`-Klasse, `StbShare.blocks()`), Backend-Tests (`test-api-sync.js`,
`test-stb-share.js`). Kein Free-Tier-Risiko: `js/user-plan.js` `isPro()` ist hart auf `true`
gesetzt, es gibt also keine zweite Paywall, die dazwischenfunkt.

Es gibt einen älteren Branch `feature/csp-phase-c` mit Commit `7c1573d`, der genau diese
zwei Lücken schon mal angegangen ist — **der Branch ist aber 8 Tage hinter master
zurückgefallen** (fehlt: signiertes Whop-Grace-Token, Blob-Sync-Umbau, CH/AT-Entfernung,
etc.) und lässt sich nicht mergen. Nur als Referenz lesen (`git show 7c1573d`), NICHT
mergen/cherry-picken. Baue direkt gegen den aktuellen `master`-Stand der drei Dateien unten.

Es fehlen zwei Client-Lücken, siehe unten. Bau beide, verifizier, committe auf `master`.

WICHTIG (geteiltes Repo): evtl. läuft eine Parallel-Session. Vor JEDEM Edit die Datei frisch
lesen; nur eigene Dateien stagen. Nicht deployen — macht der User.

## Lücke 1 (kritisch) — Steuerberater ohne eigenes Abo durchs Login-Gate lassen

Problem: `js/whop-auth.js` → `_validateAndContinue`, Block ab Zeile ~265: bei
`hasAccess === false` (Antwort von `/api/whop-access`) geht es direkt in
`_showNoMembershipScreen(me)` (Zeile ~288). Ein Steuerberater ohne eigenes Pro-Abo kommt so
nie in die App, kann seinen Public-Key nie registrieren und seinen Freigabe-Code nie sehen
→ Henne-Ei. Der Server erlaubt Grantee-Reads bereits ohne Pro (`register_pubkey`,
`list_grants`, `pull` mit `owner`-Param sind laut `api/sync.js:197` explizit Pro-frei).

Vor `_showNoMembershipScreen(me)` einfügen:
- `StbShare.registerPubkey()` aufrufen (Token ist vorhanden) — Mandant kann ihn danach
  einladen.
- Neue dünne Funktion in `js/stb-share.js` exportieren, z. B. `checkGrants()` — Wrapper um
  `_api({ action: 'list_grants' })`, gibt reines `grants`-Array zurück (kein UI, im
  Unterschied zu `clientsFlow()`, das direkt ein Modal öffnet).
- `grants.length > 0` → in Read-Only-Grantee-Modus einlassen: `_stampGrace(graceToken)` +
  `_onAuthorized(me)` (App startet normal; StB öffnet danach per Menü "📂 Mandanten" die
  Mandantenansicht).
- `grants.length === 0` → weiterhin `_showNoMembershipScreen(me)`, aber um eine StB-Sektion
  erweitern: eigenen Freigabe-Code (`me.sub` bzw. `me.id`) + Kopier-Button anzeigen (Inhalt
  kann sich an `StbShare.showCode()` orientieren), statt nur "Pro kaufen".

Verifizieren: echtes Whop-Login geht im Preview nicht (App ist Login-gated) — Browser-Smoke
mit gemocktem `fetch`/gemocktem `whop_user`-localStorage-Eintrag, analog zum Vorgehen in
`7c1573d` (siehe `git show 7c1573d -- js/whop-auth.js` als Referenz für den Test-Aufbau, Code
selbst nicht übernehmen).

## Lücke 2 (klein) — "Zugriff entziehen" beim Mandanten

Server-`revoke` existiert bereits und ist getestet (`test-api-sync.js`), aber der Owner kann
seine erteilten Freigaben weder sehen noch entziehen (nur per DevTools-Fetch möglich).

- `api/sync.js`: im `grant`-Branch (Zeile ~316) zusätzlich
  `SADD grantsby:<ownerId> <granteeId>`; im `revoke`-Branch (Zeile ~329) zusätzlich
  `SREM grantsby:<ownerId> <granteeId>` (Naming bewusst symmetrisch zum bestehenden
  `grantsfor:<granteeId>`-Set). Neue Action `list_my_grantees`: `SMEMBERS grantsby:<userId>`
  + je Eintrag `createdAt` aus dem zugehörigen `grant:<userId>:<granteeId>`-Objekt lesen und
  zurückgeben (Grantee-Klarname ist server-seitig nicht bekannt → Code + Datum reicht).
- `js/stb-share.js`: `manageFlow()` — Dialog listet erteilte Freigaben (Code + Datum) mit
  "Zugriff entziehen"-Button pro Zeile → ruft `revoke`, danach Liste neu laden + Toast.
  `_doRevoke(granteeId)` als Actions-Handler registrieren (`stb-do-revoke`).
- Einstiegspunkt: `js/whop-auth.js` ~Zeile 484-486, im selben User-Menü-Block wie
  `stb-invite`/`stb-clients`/`stb-my-code` — neuer Eintrag "🔒 Freigaben verwalten"
  (`data-action="stb-manage"`).
- `test-api-sync.js` erweitern: nach `grant` erscheint der Grantee in `list_my_grantees`
  (mit `createdAt`); nach `revoke` ist er aus der Liste verschwunden + `pull` mit `owner`
  liefert weiterhin 403 (bereits getestet, nur zur Vollständigkeit gegenprüfen).

## Bewusst NICHT bauen

Re-Key beim Entzug: `revoke` sperrt künftigen Zugriff, ein StB, der den alten Datenschlüssel
noch hat, könnte alte (bereits gepullte) Snapshots weiter entschlüsseln, bis der Owner neu
verschlüsselt. Nur im Revoke-Dialog als Hinweistext erwähnen, nicht implementieren — nur
bauen, wenn der User es ausdrücklich verlangt.

## Abschluss

- `node test-api-sync.js` + `node test-stb-share.js` grün.
- `node --check` auf allen geänderten Dateien.
- Browser-Smoke der neuen Pfade (gemockt, siehe oben) dokumentieren, echter
  2-Whop-Account-E2E bleibt beim User.
- Memory aktualisieren (`offline-grace-stb-readonly-spec.md` fortschreiben oder neue Memory
  anlegen): beide Lücken erledigt, einzig offen = echter 2-Account-E2E-Test + optionaler
  Re-Key.
- Auf `master` committen (kleiner, fokussierter Commit reicht — kein neuer Branch nötig, da
  `feature/csp-phase-c` nicht weitergeführt wird).

---

**Modell-Empfehlung: Opus 4.8.** Lücke 1 ändert das Auth-Gate — sicherheitsrelevant, mehrere
Dateien (`whop-auth.js`, `stb-share.js`, `api/sync.js`) müssen konsistent bleiben, und ein
Fehler hier kann entweder zahlende Kunden aussperren oder das Pro-Gate umgehbar machen.
Lücke 2 allein wäre Sonnet-tauglich, hängt aber am selben Kontext — fürs Bündel Opus 4.8.

---

## ~~session-prompt-stb-luecken.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste)

---

Kontext: Feature „Steuerberater Read-Only" (Envelope-Key) ist zu ~80 % gebaut und committet
auf Branch `feature/csp-phase-c` (Commits 0e9e73c → aa0089b). Lies zuerst
`plan/spec-offline-grace-stb-readonly.md` (Abschnitt „Feature 2") und
`plan/e2e-steuerberater-walkthrough.md`. Krypto (test-stb-share.js 3/3), Server-Grants
(api/sync.js, test-api-sync.js 9/9) und die In-App-UI (js/stb-share.js, Read-Only-Guard,
Banner) sind fertig + verifiziert. Es fehlen ZWEI Client-Lücken. Bau beide, verifizier,
committe auf denselben Branch.

WICHTIG (geteiltes Repo): In diesem Ordner arbeitet evtl. eine Parallel-Session. Vor JEDEM
Edit die Datei frisch lesen; nur die eigenen Dateien stagen (nie fremde uncommittete
Änderungen mitcommitten). Nicht deployen — das macht der User.

## Lücke 1 (kritisch) — Steuerberater ohne eigenes Abo durchs Login-Gate lassen

Problem: `js/whop-auth.js` → `_validateAndContinue` zeigt bei `has_access = false` den
Kauf-Screen (`_showNoMembershipScreen`). Ein StB ohne eigenes Pro-Abo kommt so nie in die
App, kann seinen Public-Key nie registrieren und seinen Freigabe-Code nie sehen →
Henne-Ei, das „kein Zweit-Abo"-Versprechen greift nicht. Der Server erlaubt Grantee-Reads
bereits ohne Pro (register_pubkey/list_grants/pull-mit-Grant sind Pro-frei).

ZUERST prüfen (der riskante Teil): Gibt es über das Login-Gate hinaus ein Hard-Gate/Paywall,
das Nicht-Pro-Accounts die App sperrt? `grep` nach UserPlan-Gating, App-Boot-Paywall,
`isPro`, Trial-Logik. Wenn ja, muss der Grantee-Read-Modus dort eine saubere Ausnahme
bekommen (z. B. Flag, das als „read-only erlaubt" gilt), sonst landet der StB im nächsten Gate.

Dann in `_validateAndContinue`, wenn `has_access = false`, VOR dem Kauf-Screen:
- `StbShare.registerPubkey()` aufrufen (Token ist da) — damit der Mandant ihn einladen kann.
- Neue exportierte Funktion `StbShare.listGrants()` (dünner Wrapper um `_api({action:'list_grants'})`,
  gibt das grants-Array zurück) abfragen.
- grants.length > 0 → in Read-Only-Grantee-Modus einlassen: `_stampGrace()` + `_onAuthorized(me)`
  (App lädt; er öffnet dann per Menü „📂 Mandanten" die Mandantenansicht).
- grants.length === 0 → einen „Steuerberater-Einstieg"-Screen zeigen mit seinem Freigabe-Code
  (= `me.sub`) + Kopier-Button, statt nur „Pro kaufen". (Kann `_showNoMembershipScreen` um eine
  StB-Sektion erweitern.)
Verifizieren, dass ein Nicht-Pro-Grantee die App wirklich bedienbar bis zur Mandantenansicht
erreicht (Browser-Smoke mit geseedetem localStorage, da echtes Whop-Login im Preview nicht geht).

## Lücke 2 (klein) — „Zugriff entziehen"-Button beim Mandanten

Server-`revoke` existiert (getestet), aber der Owner kann seine vergebenen Freigaben weder
sehen noch entziehen (nur per DevTools).
- `api/sync.js`: im `grant` zusätzlich `SADD grantedby:<ownerId> <granteeId>`; im `revoke`
  `SREM grantedby:<ownerId> <granteeId>`. Neue Action `list_my_grantees` → `SMEMBERS
  grantedby:<ownerId>` + je Eintrag das Grant-Objekt (Code + createdAt) zurück. (Grantee-Name
  ist server-seitig nicht bekannt → Code + Datum anzeigen reicht.)
- `js/stb-share.js`: `manageFlow()` — Dialog listet freigegebene StBs (Code + Datum) mit
  „Zugriff entziehen" pro Eintrag → ruft `revoke`. Menü-Eintrag in `js/whop-auth.js`
  (`openUserMenu`) „Steuerberater verwalten" oder in den Einladen-Dialog integrieren.
- `test-api-sync.js` um Test erweitern: nach `grant` erscheint der Grantee in `list_my_grantees`;
  nach `revoke` ist er weg + Pull → 403.

## Abschluss
- Verifizieren: `node test-*.js` alle grün, Browser-Smoke der neuen Pfade.
- `plan/spec-offline-grace-stb-readonly.md` + Memory `offline-grace-stb-readonly-spec.md`
  aktualisieren (Lücken erledigt; als NUR-NOCH-OFFEN bleibt der 2-Whop-Account-E2E laut
  `plan/e2e-steuerberater-walkthrough.md` + optional der Krypto-Re-Key beim Entzug).
- Auf `feature/csp-phase-c` committen. Nicht deployen.

Hinweis Re-Key (bewusst NICHT bauen, nur erwähnen): `revoke` entzieht künftigen Zugriff, aber
ein StB, der den Schlüssel behält, könnte alte Snapshots weiter entschlüsseln, bis der Owner
neu verschlüsselt. Re-Key nur bauen, wenn der User es ausdrücklich verlangt.

---

**Modell-Empfehlung: Opus 4.8.** Grund: Lücke 1 ist eine sicherheitsrelevante Änderung am
Auth-Gate mit einer unsicheren Wechselwirkung zum Hard-Gate/Paywall, die erst untersucht und
dann sauber ausgeschnitten werden muss — genau die Art Reasoning, wo Opus den Unterschied
macht. Lücke 2 allein wäre Sonnet-tauglich, hängt aber am selben Multi-Datei-Kontext
(whop-auth.js, stb-share.js, api/sync.js). Fürs Bündel: Opus 4.8.

---

## ~~session-prompt-teilzahlung-ratenzahlung.md~~ (committet e771cdb, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Teilzahlung/Ratenzahlung im Rechnungsmodul

---

Kontext: Vollaudit-Fund 9 aus
`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`. Feature-Lücke ggü.
sevDesk/lexoffice: Kunden mit Projektgeschäft (Anzahlung + Restzahlung, oder echte Ratenzahlung)
können den Zahlungsstatus einer Rechnung aktuell nicht abbilden. Größerer Scope als die übrigen
Vollaudit-Funde, daher eigene Datei.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Ist-Zustand

- Status-Enum kennt nur vier Werte: `offen` / `bezahlt` / `ueberfaellig` / `storniert`
  (`rechnungen/js/rechnung.js:81,1012,1486`). Kein Feld für Teilbetrag.
- Zahlungserfassung läuft über `showBezahltModal()` in `rechnungen/js/dokumente.js:444` — setzt
  Status direkt auf `bezahlt`, inkl. optionaler Lager-Verkaufs-Sync (verknüpfte Lagerartikel als
  verkauft markieren).
- `mahnungen.js` prüft nur `status !== 'bezahlt' && faelligkeit < today` für Mahnfähigkeit — eine
  Rechnung mit Teilzahlung wäre nach aktuellem Modell entweder fälschlich "offen" (volle Mahnung
  trotz Teilzahlung) oder man müsste sie manuell auf "bezahlt" setzen (verliert die Restschuld).
- Dashboard/Statistiken (`rech-dashboard.js`) summieren vermutlich über den Status, nicht über
  tatsächlich offene Beträge — mit Teilzahlungen würde die Umsatz-/Offene-Posten-Anzeige falsch.

## Vorschlag Scope (v1, minimal)

1. **Datenmodell**: neues Feld `teilzahlungen: [{datum, betrag, notiz}]` an der Rechnung (Array,
   analog zum bestehenden Audit-Log-Pattern), abgeleiteter Status `teilbezahlt` zusätzlich zum
   bestehenden Enum. `offenerBetrag = brutto - sum(teilzahlungen.betrag)`.
2. **Erfassung**: `showBezahltModal()` um Modus "Teilzahlung erfassen" erweitern (Betrag statt
   Vollbetrag eingeben) — bei `offenerBetrag <= 0` automatisch auf `bezahlt` wechseln, sonst
   `teilbezahlt`.
3. **Mahnwesen**: `mahnungen.js` auf `offenerBetrag` statt Bruttobetrag umstellen, Mahnung zeigt
   nur die tatsächliche Restschuld inkl. Verzugszinsen (§288 BGB, aus Fund 3 bereits gebaut) auf
   dem offenen Rest.
4. **Anzeige**: Dokumente-Liste/Dashboard zeigen `teilbezahlt` als eigenen Status-Chip mit
   Fortschrittsbalken oder "X von Y € bezahlt".
5. **PDF/Zahlungsbeleg**: bestehende Zahlungsbestätigung (falls vorhanden) muss Teilzahlungen
   einzeln ausweisen können (GoBD-Nachvollziehbarkeit — jede Teilzahlung ein eigener,
   nicht-überschreibbarer Eintrag, Audit-Log-Pflicht wie bei anderen Statusänderungen).

## Nicht in v1 (bewusst weglassen, YAGNI)

- Kein automatischer Ratenplan/-zahlungsplan mit Fälligkeitsterminen pro Rate — nur manuelle
  Erfassung einzelner Teilzahlungen bei Zahlungseingang.
- Keine Mahnstufen-Logik speziell für Teilzahlungen (nutzt bestehende Mahnstufen, nur auf
  Restbetrag).

## Akzeptanzkriterien

- Teilzahlung erfassen → `offenerBetrag` korrekt reduziert, Status wechselt zu `teilbezahlt`.
- Letzte Teilzahlung deckt Restbetrag → Status automatisch `bezahlt`.
- Mahnung auf teilbezahlter Rechnung zeigt nur Restbetrag + Zinsen auf Restbetrag, nicht auf
  ursprünglichen Bruttobetrag.
- Dashboard-Summen (Umsatz, offene Posten) bleiben korrekt bei gemischtem Bestand aus
  offen/teilbezahlt/bezahlt.
- Jede Teilzahlung landet als eigener Eintrag im zentralen Audit-Log (`js/store.js` Hash-Chain,
  siehe `[[gobd-edit-delete-rework]]`), keine stille Überschreibung alter Werte.
- Storno einer teilbezahlten Rechnung: bereits erfasste Teilzahlungen bleiben im Audit-Log
  nachvollziehbar (kein Datenverlust bei Storno).

Nach Fertigstellung: Browser-Smoketest (Rechnung anlegen → zwei Teilzahlungen erfassen → prüfen
Status/Restbetrag/Mahnung/Dashboard), danach `legal-reviewer`-Agent gegen GoBD-Anforderungen prüfen
lassen (neue Statusübergänge = neue Audit-Log-Pflicht).

---

## session-prompt-ui-politur.md

# Prompt für neue Session (interaktiv) — W4: UI-Politur

---

Kontext: User will UI hübscher, weiß noch nicht wo. Interaktiv klären, nicht blind
editieren. Alle Bereiche Kandidat (Onboarding, Dashboard, Rechnungen/Lager/Eigenbelege,
Landing).

WICHTIG: Design-System strikt einhalten (Memory `stackr-ui-v2-design-brief.md` —
"Ruhige Souveränität", dark+emerald, `styleguide.html`). Keine neue Design-Sprache,
nur bestehende Patterns konsequenter. Verifikation: Edge, nie Chrome/Firefox/Opera
(Memory `feedback-browser-edge.md`).

WICHTIG (geteiltes Repo): Parallel-Session möglich. Vor Edit Datei frisch lesen, nur
eigene Dateien stagen. Nicht deployen — macht User.

## Vorgehen

1. Preview starten, mit User Screen für Screen durch (oder Screenshots/Beschreibungen).
   Punkte sammeln VOR jedem Edit. Kein Punkt ohne explizite User-Bestätigung.
2. Pro Punkt: passt ins Design-System oder Ausnahme? Ausnahme → vor Umsetzung nachfragen.
3. Kleine Einzel-Änderungen, nach jedem Punkt Screenshot zum Abgleich.
4. Ende: Vorher/Nachher-Liste, committet.

## Akzeptanz

User-bestätigte UI-Punkte umgesetzt, Design-System eingehalten, jeder Punkt per
Screenshot verifiziert, committet mit Liste in Commit-Message.

---

## ~~session-prompt-vercel-blob-empfaenger.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Vercel Blob als Empfänger nachtragen + cookies.html-Kleinfunde

---

Kontext: Beim Umsetzen von `plan/session-prompt-vollaudit-runde2-nacharbeiten.md` (Punkt 2,
cookies.html) hat der `legal-reviewer`-Agent am 2026-07-25 einen Fund gemeldet, der **schwerer
wiegt als der ursprüngliche Anlass** und bewusst aus jener Session herausgehalten wurde, weil er
eine Sachverhaltsklärung durch den User braucht (Vercel-Konsole).

Die Cookie-/Key-Tabelle selbst ist bereits erledigt (Commit `0733e77`). Diese Session macht den
Rest.

## 0. Vorab durch den User zu klären (nicht automatisierbar)

**In welcher Region liegt der Vercel-Blob-Store?** Vercel-Dashboard → Storage → der genutzte
Blob-Store → Region. Ohne diese Angabe lässt sich Punkt 1 nicht sauber zu Ende schreiben:
- Liegt er in der EU → einfache Ergänzung des Empfängers, Regionszusage bleibt haltbar.
- Liegt er außerhalb der EU → zusätzlich Drittlandtransfer nach Art. 44 ff. DSGVO offenzulegen
  (Rechtsgrundlage, Garantien/SCC). Dann bitte auch prüfen, ob sich der Store in eine EU-Region
  umziehen lässt — das wäre die deutlich sauberere Lösung als eine Transferklausel.

Solange das offen ist: **nicht raten**. Lieber neutral formulieren (siehe Punkt 1) als eine
zweite falsche Regionszusage in einen Rechtstext schreiben.

## 1. Vercel Blob als Speicherort/Empfänger nachtragen 🔴

**Befund:** `cookies.html` behauptet, bei aktivem Cloud-Sync werde
*„ausschließlich unlesbares Chiffrat bei Upstash (Frankfurt, EU) abgelegt"*. Das ist nachweislich
unvollständig. Bei Überschreiten des Inline-Limits lädt der Client **das komplette verschlüsselte
Ledger** sowie große Anhänge (Rechnungslogo, Eigenbeleg-Foto/-PDF) zu **Vercel Blob** hoch:

- `js/cloud-sync.js` — `pushBody.blobUrl = await BlobAttachments.put(...)` (zwei Stellen:
  regulärer Push über `MAX_INLINE_CIPHER` und der 413-Retry)
- `js/blob-attachments.js` — `offloadLargeFields()` lagert Felder > Schwellwert aus
- `api/blob-upload.js` — Ziel-Host `https://….public.blob.vercel-storage.com/`

Rechtlich sind das **zwei getrennte Probleme**:
1. Vercel Blob ist ein **nicht genannter Empfänger** (Art. 13 Abs. 1 lit. e DSGVO).
2. Die Regionszusage „Frankfurt, EU" gilt **nur für Upstash** und deckt den Blob-Store nicht ab.

Dass der Inhalt reines Chiffrat ist, ändert an der Nennungspflicht nichts.

**Betroffen sind drei Dateien — alle drei anfassen, sonst bleibt der Widerspruch:**
- `cookies.html` — Abschnitt 2, der Cloud-Sync-Absatz (die Stelle mit „ausschließlich … Upstash")
- `datenschutz.html` — Ziffer 4; nennt Upstash + Vercel („Transport-Funktion"), aber Vercel Blob
  als *Speicherort* fehlt
- `verfahrensdokumentation.html` — dieselbe Lücke im Abschnitt zur Datenhaltung

Formulierungsvorschlag solange die Region ungeklärt ist: Upstash **und** Vercel Blob als
Speicherorte nennen, die EU-Zusage explizit nur auf Upstash beziehen und für den Blob-Store
keine Regionsaussage treffen. Sobald die Region feststeht, präzisieren.

Bei Bedarf den `legal-reviewer`-Agent für die konkrete Formulierung heranziehen — er hat den
Fund gemacht und kennt den Kontext.

## 2. cookies.html — fünf Kleinfunde aus demselben Review

Alle in `cookies.html`, alle unabhängig voneinander umsetzbar:

1. **Stand-Datum veraltet** (Zeile ~25): „Stand: Juni 2026" → Juli 2026. Seit Juni hat sich der
   beschriebene Sachverhalt geändert (Blob-Architektur seit 2026-07-15). Sinnvollerweise erst
   ganz am Ende dieser Session setzen, wenn alle Textänderungen drin sind.
2. **§-Zitat schief**: „Rechtsgrundlage für alle o. g. Technologien: § 25 Abs. 2 TDDDG". § 25
   Abs. 2 ist eine *Ausnahme vom Einwilligungserfordernis*, keine Rechtsgrundlage für die
   Verarbeitung. Sauber: Zugriff aufs Endgerät einwilligungsfrei nach **§ 25 Abs. 2 Nr. 2
   TDDDG**, Rechtsgrundlage der Verarbeitung **Art. 6 Abs. 1 lit. b DSGVO**. Die Nummer (Nr. 2)
   auch in Abschnitt 3 ergänzen.
3. **Abschnitt 5 gibt eine praktisch falsche Handlungsanweisung**: Der Text rät, „Stackr-Cookies"
   zu löschen. Stackr setzt aber **kein einziges** `document.cookie` — wer nur Cookies löscht,
   löscht bei Stackr gar nichts; Abmeldung und Datenverlust hängen an localStorage/IndexedDB.
   Umformulieren auf „Cookies **und lokal gespeicherte Website-Daten**" plus deutlicher
   Warnhinweis, dass das Löschen der Website-Daten nicht gesicherte Buchhaltungsdaten vernichtet,
   mit Verweis auf die Backup-Funktion. Wegen § 147 AO auch GoBD-relevant.
4. **jsDelivr-Wording zu weich**: „kann deine IP-Adresse an CDN-Server übertragen werden" — bei
   einem Fremd-CDN ist das kein „kann", sondern technisch zwingend. → „wird … übertragen".
   Als Dauerlösung erwägen, die Bibliotheken selbst zu hosten (wie bei den Fonts in
   `css/legal.css` schon geschehen) — dann entfällt die Klausel ganz.
5. **IndexedDB-Beschreibung untertreibt**: „für größere Datenmengen (z. B. umfangreiche
   Buchungshistorie)". Dort liegen laut `js/blob-attachments.js` auch **Rechnungslogos,
   Eigenbeleg-Fotos und PDFs** als Base64 — potenziell personenbezogene Daten Dritter
   (Lieferanten, Kunden), und genau diese Felder werden beim Cloud-Sync ausgelagert. Benennen.

Zusatzhinweis desselben Reviews (optional, kein Verstoß): Abschnitt 4 „Drittanbieter" nennt
Whop und jsDelivr korrekt, aber weder Upstash noch Vercel — obwohl Abschnitt 2 Upstash als
Speicherort bereits thematisiert. Mindestens ein Querverweis auf `datenschutz.html` Ziffer 4
ans Ende von Abschnitt 4.

## Hinweise zur Umsetzung

- `css/legal.css` definiert **nur** `.badge-required` — jede andere Badge-Klasse rendert
  unstyled. Gilt für alle Rechtstext-Seiten.
- Repo ist UTF-8 ohne BOM; nicht über eine PowerShell-Textpipeline editieren, sondern
  Edit/Write oder Python verwenden.
- Nach jeder Textänderung an einer Seite mit Meta-CSP daran denken: die Seiten haben seit
  `f687a51` zusätzlich einen CSP-**Header** aus `vercel.json`. Wer eine neue Seite anlegt, muss
  dort einen Eintrag ergänzen. Zum Gegenprüfen gibt es `scripts/csp-preview-server.js`
  (liefert die echten Header lokal aus, `node scripts/csp-preview-server.js`).
- Pro logischer Änderung ein eigener Commit.

## Abschluss

- `plan/vollaudit-runde2-2026-07-25.md` — Prioritäten-Tabelle am Ende um den Vercel-Blob-Fund
  ergänzen bzw. dessen Status fortschreiben.
- Diese Datei danach löschen oder als erledigt markieren.

---

**Modell-Empfehlung: Sonnet 5.** Reine Rechtstext-Arbeit mit klar umrissenem Scope. Die einzige
echte Abwägung (Formulierung bei ungeklärter Blob-Region) gehört an den `legal-reviewer`-Agent.

---

## ~~session-prompt-vollaudit-a11y-rest.md~~ (erledigt, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Vollaudit-Rest: Accessibility (Modals, Labels, Touch-Targets, Kontrast)

---

Kontext: Vollaudit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`,
Fund 10, 11, 16, 17). Alle vier sind Accessibility-Funde in Rechnungen/Eigenbelege, hier gebündelt.

## ⚠️ Vor Start prüfen: möglicherweise schon in Arbeit

Stand 2026-07-24 lagen im Arbeitsverzeichnis 8 uncommittete Dateien (`css/style.css`,
`eigenbelege/js/app.js`, `eigenbelege/index.html`, `rechnungen/js/app.js`,
`rechnungen/js/dokumente.js`, `rechnungen/js/mahnungen.js`, `rechnungen/js/rechnung.js`,
`rechnungen/index.html`) mit Label-`for=`/`id`-Verknüpfungen und `id="modalTitle"` an Modals —
sieht nach Fund 11 (und teilweise 10) aus, vermutlich von einer parallelen Session.
**Zwingend zuerst `git status --short` + `git diff --stat` prüfen** und den aktuellen Stand dieser
Datei gegen die Funde unten abgleichen, bevor doppelt gearbeitet wird.

## Fund 10: Modals ohne Fokus-Trap/ARIA/ESC in beiden Sub-Apps

`eigenbelege/js/app.js:1754` (`openModal`/`closeModal`), `rechnungen/js/app.js:124-150`
(`RechApp.showModal`): kein `role="dialog"`, `aria-modal`, initialer Fokus, Tab-Trap, ESC-Handler.

Haupt-App-Modal (`js/app.js:390-414,739-741`) hat das bereits korrekt — als Vorlage nutzen.

Fix: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (verweist auf Modal-Titel-Element)
ergänzen, initialen Fokus auf erstes fokussierbares Element setzen, Tab-Taste innerhalb des Modals
einfangen (Fokus-Trap), ESC schließt das Modal — 1:1 nach dem Muster aus `js/app.js`.

## Fund 11: Labels systemweit ohne `for`/`id`-Verknüpfung

33× in `eigenbelege/js/app.js`, 97× in `rechnungen/js/*.js` — `<label>` ohne `for=`. WCAG
1.3.1/3.3.2, Screenreader-Nutzer können Felder nicht per Label-Klick fokussieren.

Fix: mechanisch — jedes `<label>` bekommt `for="<eindeutige-id>"`, zugehöriges Input/Select/
Textarea bekommt passende `id`. Bei generierten Listen (z.B. Positionszeilen) IDs mit Index
eindeutig machen (`pos_${i}_menge` statt `pos_menge`).

## Fund 16: Touch-Targets <44px bei `.btn`/`.btn-sm` mobile

`css/style.css:2540` (`.btn-sm`, kein `min-height`) und Basis-`.btn` (Z. 858-870). `.btn-icon`/
`.btn-small` sind bereits korrekt auf 44px (Referenzmuster, gleiches Pattern wie
`[[persona-cta-touch-target]]`-Fix — als Vorlage nutzen).

Fix: `min-height: 44px` (bzw. äquivalentes Padding) auf `.btn`/`.btn-sm` ergänzen, nur in
Mobile-Breakpoints falls Desktop-Layout dadurch zu klobig würde.

## Fund 17: Kontrast `--text-muted` unter AA

`css/style.css:35,67` — `#71807a` auf `#161a18` ≈4.25:1, unter AA-Minimum 4.5:1. Betrifft
Footer-Links Impressum/Datenschutz, diverse Formular-Hinweistexte.

Fix: Farbwert leicht aufhellen bis ≥4.5:1 Kontrastverhältnis erreicht ist (Kontrast-Checker nutzen),
in beiden Theme-Varianten (falls Light/Dark getrennte Werte existieren) prüfen.

## Akzeptanzkriterien

- Modal in Rechnungen/Eigenbelege: Tab bleibt innerhalb des Modals, ESC schließt, Screenreader
  kündigt Titel beim Öffnen an.
- Stichprobe Screenreader/Tastatur: Label-Klick fokussiert zugehöriges Feld in beiden Sub-Apps.
- Mobile-Ansicht: `.btn`/`.btn-sm` real antippbar (≥44×44px), kein visueller Bruch auf Desktop.
- Kontrast-Checker bestätigt ≥4.5:1 für `--text-muted` auf den betroffenen Hintergründen.

Nach Fertigstellung: `/accessibility`-Skill erneut laufen lassen zur Bestätigung, dass die vier
Funde behoben sind.

---

## session-prompt-vollaudit-runde2-nacharbeiten.md

# Prompt für neue Session (copy-paste) — Vollaudit Runde 2: Nacharbeiten umsetzen

---

Kontext: `plan/vollaudit-runde2-2026-07-25.md` enthält die Ergebnisse eines
Rechts-/Compliance-Audits (Cross-Page-Konsistenz, GoBD-Doku-Aktualität, `/datenschutz`- und
`/security-stackr`-Fokusdurchlauf, 2026-07-25). Die Diagnose ist abgeschlossen — diese Session
setzt die dort identifizierten, konkret umsetzbaren Findings um.

**Wichtig zur Einordnung:** Kein 🔴 kritischer Fund, alles BALD/NICE. Keine Eile, aber sauber
einzeln committen (nicht alles in einen Commit).

## 0. Vorab: WIP-Status des Cloud-Anker-Codes prüfen

Punkt 1 unten hängt an einem Teil des zum Zeitpunkt des Audits noch **uncommitteten** WIP-Codes
(`js/store.js`, `js/cloud-sync.js`, `js/protokoll.js`, `api/sync.js` — neuer
"Cloud-Anker"-Mechanismus für externe Audit-Log-Manipulationserkennung). Vor Bearbeitung:
`git log --oneline -- js/store.js js/cloud-sync.js js/protokoll.js api/sync.js` und
`git status` prüfen, ob dieser Code inzwischen committet/live ist.
- **Falls noch WIP/uncommitted:** Punkt 1 zurückstellen — nicht Code dokumentieren, der noch
  nicht live ist. Restliche Punkte (2-4) sind davon unabhängig und können unabhängig
  bearbeitet werden.
- **Falls committet:** Punkt 1 wie beschrieben umsetzen.

## 1. Verfahrensdokumentation um Cloud-Anker ergänzen (nur falls Code committet, siehe 0.)

Datei: `verfahrensdokumentation.html`, Abschnitt 4 ("Nachvollziehbarkeit — Änderungsprotokoll").

Ergänze 2-3 Sätze im bestehenden Stil des Dokuments: Bei aktivem Cloud-Sync existiert
zusätzlich zur lokalen Hash-Kette ein externer, serverseitig einmal geschriebener
Referenzpunkt (Content-Hash je Audit-Log-Eintrag, append-only in Upstash Redis, siehe
`api/sync.js` Actions `anchor`/`anchor_pull`, Client-Seite `js/cloud-sync.js`
`_pushAuditAnchors()`/`verifyAuditAnchors()`). Kernaussage: das macht eine rückwirkende,
in sich konsistente Neuberechnung der lokalen Hash-Kette erkennbar, weil der einmal an den
Server gemeldete Hash nicht mehr veränderbar ist. Nur relevant wenn Cloud-Sync aktiv ist —
das sollte auch so im Text stehen (kein Widerspruch zum Local-First-Prinzip).

Änderungshistorie am Ende der Datei (Abschnitt 9, aktuell nur "Juli 2026 — Ersterstellung")
um einen neuen Eintrag mit heutigem Datum ergänzen.

## 2. cookies.html — Vollständigkeits-Behauptung korrigieren

Datei: `cookies.html`, Abschnitt 2 ("Welche Cookies nutzt Stackr?").

Befund: Der Satz *"Alle eingesetzten Technologien sind im Folgenden vollständig aufgelistet"*
stimmt nicht mit den tatsächlichen localStorage-Keys im Code überein — die Tabelle nennt
`stackr_*`/`stackr_settings`/`stackr_plan`, real verwendet wird aber ein `oyi_*`-Präfix
(z. B. `oyi_active_company`, `oyi_sync_enabled`) plus mehrere unpräfixierte, in der Tabelle
gar nicht genannte Keys (`agb_accepted`, `app_theme`, `eb_sidebar_collapsed`, `_oyi_lsmirror`,
`_oyi_lsmirror_ts`, `purchases` u. a. — Stichprobe aus `rechnungen/js/app.js` und
`eigenbelege/js/app.js`, nicht abschließend).

Vor dem Schreiben: vollständige, aktuelle Key-Liste ermitteln, z. B.
`grep -rhoE "localStorage\.(setItem|getItem)\('[^']+'" js/ rechnungen/js/ eigenbelege/js/ lager/*.js app.html index.html landing-v2.html | sort -u`
(Bash-Tool) — nicht nur die Stichprobe aus dem Audit-Report übernehmen, es können weitere
Module (Lager, Finanzen, GbR) eigene Keys haben.

Zwei mögliche Lösungsrichtungen (Session soll selbst entscheiden, ggf. den
`legal-reviewer`-Agent für die Formulierung heranziehen):
- (a) Vollständigkeits-Satz zu "die wichtigsten Kategorien" bzw. "beispielhaft" abschwächen —
  schneller, aber weniger informativ für den User.
- (b) Tabelle inhaltlich korrigieren/erweitern auf Basis der ermittelten Key-Liste.

Keine sensiblen Daten unter den ungenannten Keys (Theme, Sidebar-Zustand, AGB-Timestamp,
Merge-Spiegel) — es geht um Textgenauigkeit, nicht um eine echte Datenschutzverletzung.

## 3. CSP als HTTP-Header ergänzen (Defense-in-Depth)

Datei: `vercel.json`. Aktuell nur `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS,
`X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` als globale Header — **keine**
`Content-Security-Policy`. CSP existiert bisher nur als `<meta>`-Tag in 12 einzelnen
HTML-Dateien (greift erst nach `<head>`-Parse, `frame-ancestors`/`report-uri` funktionieren
über `<meta>` gar nicht — praktisch abgefedert durch das bereits vorhandene
`X-Frame-Options: DENY`, aber ein zentraler Header wäre robuster).

Ergänze einen `Content-Security-Policy`-Header im bestehenden `headers`-Array von
`vercel.json`. Die Meta-CSPs unterscheiden sich leicht pro Seite (z. B. `app.html` erlaubt
in `connect-src` zusätzlich `api.whop.com`, `*.public.blob.vercel-storage.com`,
`*.make.com`, während `index.html` nur `'self'` braucht) — das ist bewusst so eng wie
möglich pro Seite gehalten (siehe Audit-Report, Abschnitt D.2) und sollte **nicht**
pauschal aufgeweicht werden. Prüfen: lässt sich in `vercel.json` ein Routing-spezifischer
Header setzen (mehrere `source`-Patterns, je einer für `/app` bzw. `/`), oder ist ein
gemeinsamer, ausreichend enger Wert für alle Seiten praktikabler? Nach der Änderung:
lokal (`vercel dev` oder Preview-Deploy) durchklicken und Browser-Konsole auf neue
CSP-Verletzungen prüfen — nichts darf blockiert werden, was vorher lief.

## 4. ui-lab.html — fehlenden SRI-Hash ergänzen

Datei: `ui-lab.html`, Zeile 9:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.44.0/dist/tabler-icons.min.css">
```
Fehlt `integrity="sha384-…"` + `crossorigin="anonymous"`, anders als in `app.html` und den
anderen Sub-Pages (dort als Vorlage nehmen, gleiche Tabler-Icons-Version prüfen — falls
Version abweicht, neuen Hash für exakt diese Version generieren, nicht den bestehenden
Hash kopieren wenn die Versionsnummer eine andere ist).

## Nicht Teil dieser Session (macht der User selbst, nicht automatisierbar)

- Upstash-/Vercel-Dashboard-Check, ob das Standard-DPA für den genutzten Account-Plan gilt.
- Manueller Spotcheck im Whop-Checkout-Flow (werden volle AGB/Trial-Bedingungen vor
  Zahlungspflicht sichtbar angezeigt/verlinkt?).
- Versand der vorbereiteten Whop-Bestätigungsanfrage aus `plan/whop-dpa-anfrage.md`.

## Abschluss

- `plan/vollaudit-runde2-2026-07-25.md` — erledigte Zeilen in der Prioritäten-Tabelle am
  Ende mit "✅ erledigt <Datum>" ergänzen (Zeile nicht löschen, nur Status ergänzen).
- Pro logischer Änderung einen eigenen Commit (mind. getrennt: Verfahrensdoku, cookies.html,
  vercel.json+CSP, ui-lab.html-SRI) — nicht alles in einen Commit.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Text-/Config-Änderungen mit klar umrissenem Scope,
kein komplexes Architektur-Reasoning nötig. Einzige Stelle mit echtem Abwägungsbedarf ist
Punkt 2 (Formulierungsentscheidung a/b) — dafür bei Bedarf den `legal-reviewer`-Agent
heranziehen statt aus eigener Einschätzung zu entscheiden.

---

## session-prompt-whop-dpa-anfrage.md

# Prompt für neue Session (copy-paste) — Whop-DPA/AV-Vertrag: Anfrage vorbereiten

---

Kontext: P0-6 aus `plan/offene-punkte-2026-07-15.md` — Whop-DPA/AV-Vertrag (Art. 28
DSGVO) ist noch nicht angefordert. Whop tritt für Auth+Payment als **eigenständig
Verantwortlicher** auf (nicht Auftragsverarbeiter, siehe `datenschutz.html`, Abschnitt
"Auftragsverarbeitung (AVV)"), trotzdem kann für bestimmte Datenflüsse (z. B. reine
Zahlungsabwicklungsdaten) ein DPA/Subprozessor-Nachweis relevant/anfragbar sein — das
muss diese Session erst klären, nicht annehmen.

**Wichtig zur Einordnung:** Diese Session recherchiert und **entwirft nur die Anfrage**
(Text + Ansprechpartner/Weg bei Whop). Das tatsächliche Absenden/Anfordern bei Whop
macht der User — das ist Kommunikation mit einem Drittanbieter im Namen des Unter-
nehmens, keine Code-Änderung.

## 1. Erst klären: was genau fehlt uns von Whop?

- `datenschutz.html` (Abschnitt 5 „Whop") nochmal lesen — dort steht bereits, dass
  Whop als eigenständig Verantwortlicher auftritt, nicht als Auftragsverarbeiter.
  Falls das rechtlich korrekt ist, ist ein klassischer AVV/DPA nach Art. 28 DSGVO
  gar nicht das passende Instrument — dann braucht es stattdessen ggf. einen
  **Joint-Controller-Nachweis** oder schlicht die öffentlich verfügbaren Whop-
  Datenschutz-/SCC-Dokumente als Beleg für den Transfermechanismus (Art. 44ff DSGVO).
  **Das zuerst mit dem `legal-reviewer`-Agent klären, bevor eine "DPA-Anfrage" formuliert
  wird, die am eigentlichen Bedarf vorbeigeht.**
- Falls doch ein AVV-Bedarf besteht (z. B. für den optionalen Cloud-Sync-Pfad, falls
  Whop dort irgendeine Rolle spielt — verifizieren, ob das der Fall ist, laut Memory
  `cloud-sync-blob-architecture.md` sind das eigentlich Vercel/Upstash, nicht Whop):
  das als Grundlage für die Anfrage nehmen.

## 2. Recherche: wo/wie fordert man das bei Whop an?

- Whop-Entwicklerdokumentation / Whop-Support-Kanäle nach "Data Processing Agreement",
  "DPA", "Subprocessor list", "GDPR" durchsuchen (WebSearch/WebFetch auf offiziellen
  Whop-Domains, keine Drittquellen).
- `agb.html` referenziert bereits `https://whop.com/buyer-terms/` — prüfen ob es eine
  vergleichbare offizielle Seite für Merchant-seitige Datenschutz-/Compliance-Doku gibt
  (z. B. `whop.com/legal`, `whop.com/privacy`, o. ä. — NICHT raten, tatsächlich
  nachsehen und die echte URL im Ergebnis nennen).
- Prüfen ob es einen Whop-Business-/Merchant-Support-Kontakt (E-Mail, Formular, Dashboard-
  Funktion) gibt, über den man als Merchant (nicht als Endkunde) Compliance-Dokumente
  anfragt.

## 3. Anfrage-Text entwerfen

Kurzer, professioneller E-Mail-/Formular-Entwurf (Deutsch + Englisch, falls der
Whop-Support vermutlich englischsprachig ist):
- Wer wir sind (Stackr / Secondlife Vintage, Einzelunternehmen, DE) und welche
  Whop-Produkte/IDs genutzt werden (Merchant-Account-Kontext, keine Kundendaten).
- Konkrete Bitte: DPA/Subprozessor-Liste bzw. — je nach Ergebnis aus Schritt 1 —
  Bestätigung des Verantwortlichkeits-Status und Nachweis des Transfermechanismus
  (SCC/DPF) für EU-Kunden-Daten.
- Referenz auf die eigene Datenschutzerklärung (Link `datenschutz.html`), damit
  Whop den Kontext hat.

## Abschluss

- Ergebnis: `plan/whop-dpa-anfrage.md` mit (a) Klärung ob AVV oder Joint-Controller-
  Nachweis der richtige Ansatz ist, (b) recherchierter Weg/Kontakt bei Whop
  (mit echter, verifizierter URL/Kontaktweg — kein Platzhalter), (c) fertiger
  Anfrage-Text zum Copy-Paste für den User.
- Nichts selbst an Whop senden.
- `plan/offene-punkte-2026-07-15.md` (P0-6-Zeile, Abschnitt "Rechtliches") nach
  Abschluss aktualisieren.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Recherche + Textentwurf, keine Code-Änderung.
Die einzige Stelle mit echtem Reasoning-Bedarf (AVV vs. Joint-Controller, Schritt 1)
sollte über den `legal-reviewer`-Agent laufen statt aus eigener Einschätzung entschieden
werden — Sonnet reicht, wenn dieser Agent die rechtliche Einordnung übernimmt.

---

## ~~session-prompt-zufluss-teilzahlung-steuermodule.md~~ (committet e771cdb, siehe plan/OFFEN.md §6)

# Prompt für neue Session (copy-paste) — Zufluss-Prinzip: Teilzahlungen fehlen in Steuermodulen

---

Kontext: Gefunden am 2026-07-25 vom `legal-reviewer`-Agent beim GoBD-Check des
Teilzahlungsfeatures (`plan/session-prompt-teilzahlung-ratenzahlung.md`, umgesetzt in
Commits `7b86c68`/`d50c852`). Größerer, risikoreicherer Scope als die übrigen Funde dieser
Session, daher eigene Datei — **vor Umsetzung erneut den `legal-reviewer`-Agent gegen den
konkreten Implementierungsvorschlag laufen lassen**, da hier echtes Steuerrecht (§11 EStG,
§20 UStG) betroffen ist.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Ist-Zustand

Teilzahlungen (`inv.teilzahlungen: [{datum, betrag}]`, additiv seit Fund 9 des Vollaudits,
siehe `[[teilzahlung-ratenzahlung]]`) ändern bewusst NICHT den Rechnungsstatus — eine
Rechnung mit Teilzahlung bleibt `offen`/`ueberfaellig`/`versendet`, bis der volle Restbetrag
beglichen ist. Erst dann setzt `showBezahltModal()` (`rechnungen/js/dokumente.js:444-541`)
`status = 'bezahlt'` und ruft `Store.createSaleFromInvoice()` (`js/store.js:2345-2413`) auf,
die einen `Sale`-Datensatz mit `datum = invoice.bezahltAm || invoice.datum` (Zeile 2386)
erzeugt — dem Datum der SCHLUSSZAHLUNG, nicht der einzelnen Teilzahlungen.

Alle Steuer-/Finanzmodule erkennen "bezahlte Rechnung als Einnahme" über exakt dasselbe,
mehrfach dupliziertes Muster: eine `unsyncedInvoices`/`unsyncedInv`-Filterung auf
`inv.status !== 'bezahlt'` (Ausschluss) kombiniert mit `Utils.isInPeriod(inv.bezahltAm ||
inv.datum, startDate, endDate)`. Betroffene Stellen:

- `js/euer.js:95-105` (EÜR, §4 Abs.3 EStG — **immer** Zufluss-Prinzip, unabhängig vom
  USt-Modus)
- `js/dashboard.js:44-58`
- `js/bilanz.js:44-55`
- `js/statistiken.js:105-120`
- `js/gbr.js:754-765`
- `js/schweiz.js:336-344`
- `js/ustvoranmeldung.js:133-145` (nur der **Ist-Versteuerungs**-Zweig, `_isSoll()===false`;
  der Soll-Zweig, Zeile 58-132, liest direkt `status ∈ {versendet, bezahlt}` +
  Rechnungsdatum und ist von diesem Problem NICHT betroffen, da Soll-Versteuerung ohnehin am
  Rechnungsdatum hängt, nicht am Zahlungseingang — §13 UStG)
- `js/datev.js:125` (Soll/Ist-Unterscheidung ähnlich wie ustvoranmeldung.js — Ist-Zweig
  vermutlich gleiches Muster, gegenprüfen)
- `js/gbr-modul.js:35-37` — Sonderfall: filtert nach `(inv.datum||'').startsWith(y)` (dem
  RECHNUNGSDATUM, nicht `bezahltAm`) UND `status === 'bezahlt'`. Das ist eine eigene,
  bereits vor dieser Session bestehende Inkonsistenz zu den anderen Modulen (Zufluss im
  Jahr der Rechnungsstellung statt im Jahr der Zahlung) — separat zu bewerten, nicht
  Gegenstand dieses Fixes, aber bei der Umsetzung im Hinterkopf behalten.

**Konkrete Lücke**: Eine im Dezember tatsächlich zugeflossene Teilzahlung erzeugt aktuell in
KEINEM dieser Module einen Einnahme-/Umsatz-Eintrag, wenn die Rechnung erst im Januar des
Folgejahres vollständig beglichen wird — die gesamte Zahlung (inkl. der Dezember-Rate)
landet steuerlich komplett im Folgejahr. Das verstößt gegen:

- **§11 Abs.1 EStG** (Zuflussprinzip bei EÜR) — betrifft ALLE EÜR-Nutzer, unabhängig vom
  USt-Modus.
- **§20 UStG** (Ist-Versteuerung) — betrifft nur Nutzer mit `ustVersteuerungsart === 'ist'`
  (laut Code-Kommentar: bis 800k€ Vorjahresumsatz/Freiberufler — ein relevanter, aber nicht
  der einzige Nutzersegment).

Bei Soll-Versteuerung (§13 UStG, der App-Default) ist nur die EÜR-Seite (Einnahmenseite,
nicht die Umsatzsteuer) betroffen, da die UVA dort ohnehin am Rechnungsdatum hängt.

## Vorschlag Scope (v1, minimal — zur Diskussion, vor Umsetzung mit legal-reviewer abstimmen)

1. **Zufluss bei jeder Teilzahlung erfassen**: `Store.addRechTeilzahlung()`
   (`js/store.js`, neu in dieser Session eingeführt) um einen anteiligen Einnahme-Eintrag
   erweitern — z.B. einen "partial Sale"-artigen Datensatz mit `datum = teilzahlung.datum`,
   `verkaufspreis = teilzahlung.betrag`, `_invoiceId = invoiceId`, `_teilzahlung = true`
   (Unterscheidungs-Flag), OHNE Einkaufspreis-Verknüpfung (Wareneinkauf wird bei EÜR/Bilanz
   ohnehin unabhängig über `Store.getPurchases()` zum Bezahldatum des Einkaufs abgezogen,
   nicht über die Sale-Verknüpfung — siehe Kommentar in `js/euer.js:114`).
2. **Doppelzählung bei Schlusszahlung vermeiden**: `createSaleFromInvoice()`
   (`js/store.js:2345`) darf beim finalen `showBezahltModal()`-Aufruf NICHT mehr den vollen
   `brutto`-Betrag verbuchen, wenn bereits Teilzahlungs-Einträge existieren — nur den
   tatsächlichen Restbetrag (`brutto - teilzahlungSumme(invoice)`), sonst wird der bereits
   über Teilzahlungen erfasste Teil doppelt gezählt.
3. **Steuersatz-Split bei Teilzahlungen**: Bei Rechnungen mit gemischten MwSt-Sätzen
   (7%/19%/0%) muss eine Teilzahlung anteilig auf die Positionen aufgeteilt werden (analog zu
   `createSaleFromInvoice`s `saetze`-Logik, Zeile 2406-2409) — oder, falls das zu komplex
   wird für v1: Teilzahlungen bei Rechnungen mit gemischten Sätzen vorerst ablehnen/warnen
   und nur bei einheitlichem Satz zulassen (siehe "Nicht in v1").
4. **Betroffene Module NICHT einzeln umbauen**: Da alle Module (`euer.js`, `dashboard.js`,
   `bilanz.js`, `statistiken.js`, `gbr.js`, `schweiz.js`) bereits identisch über
   `Store.getSales()` + eine separate `unsyncedInvoices`-Liste rechnen, sollte es reichen,
   den anteiligen Teilzahlungs-Sale in `Store.getSales()` selbst auftauchen zu lassen (Punkt
   1) — die bestehende `unsyncedInvoices`-Sonderbehandlung bezieht sich dann nur noch auf den
   tatsächlichen Restbetrag bei Schlusszahlung (Punkt 2). Das minimiert Änderungen an den
   Steuermodulen selbst (Ist-UVA in `ustvoranmeldung.js:133-145` funktioniert dann
   automatisch mit, da sie direkt `Store.getSales()` liest).
5. **Storno-Fall**: Wird eine Rechnung mit bereits erfassten Teilzahlungen storniert
   (`Store.stornoRechInvoice`), müssen die zugehörigen Teilzahlungs-Sales ebenfalls als
   storniert markiert werden (analog zum bestehenden Cascade-Storno für den regulären
   `linkedSale`, `js/store.js:2104-2107) — sonst bleibt eine stornierte Rechnung als Einnahme
   in EÜR/Bilanz stehen.

## Nicht in v1 (bewusst weglassen, YAGNI)

- Kein rückwirkendes Neu-Berechnen bereits bestehender Teilzahlungen aus der Zeit vor diesem
  Fix (Altdaten bleiben wie erfasst — nur neue Teilzahlungen ab Fix-Datum bekommen den
  anteiligen Sale-Eintrag).
- `gbr-modul.js`-Inkonsistenz (Rechnungsdatum statt Zahlungsdatum) wird hier NICHT mit
  gefixt — eigener, unabhängiger Fund.
- Kein UI-Warnhinweis beim Erfassen einer Teilzahlung über einen Jahres-/
  Voranmeldezeitraumwechsel hinweg (wäre eine sinnvolle Ergänzung, aber nicht
  blockierend für v1).
- Teilzahlungen bei Rechnungen mit gemischten MwSt-Sätzen: siehe Punkt 3 — ggf. erst mal nur
  einheitliche Sätze unterstützen, gemischte Sätze als bekannte Einschränkung dokumentieren.

## Akzeptanzkriterien

- Teilzahlung im Dezember auf eine erst im Januar vollständig beglichene Rechnung erscheint
  in der EÜR des Dezember-Jahres als Einnahme in Höhe der Teilzahlung (nicht erst im Januar).
- Bei Ist-Versteuerung erscheint dieselbe Teilzahlung in der UVA des Dezember-Voranmeldezeitraums.
- Die Schlusszahlung im Januar erscheint NUR noch mit dem Restbetrag als Einnahme im
  Januar — keine Doppelzählung des bereits im Dezember erfassten Teils.
- Summe aller Teilzahlungs-Einnahmen + Schlusszahlungs-Rest über die Zeit = ursprünglicher
  Bruttobetrag der Rechnung (Kontrollrechnung für Tests).
- Storno einer teilbezahlten Rechnung storniert auch alle zugehörigen Teilzahlungs-Sales.
- Dashboard/Bilanz/Statistiken/GbR-Modul (Regelbesteuerung-Zweig, wo unbetroffen von Ist/Soll)
  zeigen weiterhin korrekte, unveränderte Summen für Rechnungen OHNE Teilzahlungen
  (Regressionscheck).

Nach Fertigstellung: `legal-reviewer`-Agent erneut gegen die konkrete Umsetzung laufen
lassen (Zufluss-Prinzip ist scharfes Steuerrecht, keine Grauzone), danach Browser-Smoketest
mit einer Rechnung, deren Teilzahlung und Schlusszahlung in unterschiedliche Kalenderjahre
oder USt-Voranmeldezeiträume fallen.

---

## anwalt-notiz-trial-widerruf.md

# Anwalts-Notiz: Trial-Klausel / § 356 Abs. 5 BGB (offen)

Die 7-Tage-Trial-Ergänzungen sind live (Commit 78ff1d5):
- `agb.html` §4 — Unterabschnitt „Kostenlose Testphase (7 Tage)" (Karte hinterlegen, Auto-Charge nach 7 Tagen, 1× pro Whop-Konto)
- `agb.html` §6 — Absatz „Verhältnis zur kostenlosen Testphase" (Widerrufsfrist ab Vertragsschluss)
- `refund.html` §1 — Absatz „Hinweis zur kostenlosen 7-Tage-Testphase"
- `refund.html` §3 — Unterabschnitt „Kostenlose Testphase (7 Tage)"

**Offene anwaltliche Prüfung (in dieselbe Runde wie §11 AGB-Haftung):**

Die Formulierung zum **vorzeitigen Erlöschen des Widerrufsrechts** (§ 356 Abs. 5 BGB) in
agb.html §6 / refund.html §1 ist risikobehaftet: Sie navigiert bewusst um die harte Frage
herum, ob „vollständige Ausführung" bei einem **Dauerschuldverhältnis (Abo)** überhaupt
taggenau eintritt („…wird praktisch erst relevant, sobald die Testphase abgelaufen ist und
mit der ersten kostenpflichtigen Abbuchung die vollständige Ausführung des Vertrags
beginnt…"). Zu klären:

1. Tritt „vollständige Ausführung" i.S.v. § 356 Abs. 5 BGB beim Abo überhaupt ein, oder
   müsste die Klausel präziser auf „in Anspruch genommene Nutzung" abstellen?
2. Ist die weiche Formulierung („wird praktisch erst relevant") haltbar, oder braucht es
   eine explizite Aussage, ob das Widerrufsrecht während des Trials zur Disposition steht?

→ Geht ins Anwalt-Briefing aus Launch-Prompt P0-6 (plan/launch-prompts.md).

*Quelle: plan/trial-agb-diff-vorschlag.md (gelöscht 2026-07-12, alle Diffs umgesetzt).*

---

## differenzbesteuerung-25a-offene-luecken.md

# §25a Differenzbesteuerung — offene Lücken (legal-reviewer, 2026-07-21)

Kein §14c-Blocker, beide Punkte fehlern Richtung Überzahlung (steuerstrafrechtlich ungefährlich),
aber vor breiterem Rollout an die jeweilige Zielgruppe nachzuziehen.

## 1. Pauschal 19% statt möglicher 7%-Sonderfälle

**Wo:** `js/ustvoranmeldung.js` (`_calcPeriode()`, Marge-Berechnung), `js/steuer-berechnung.js`
(`margeEinzeldifferenz`/`margeGesamtdifferenz`, Parameter `satz` wird überall fest mit `19`
aufgerufen).

**Problem:** Bei Kunstgegenständen/Sammlerstücken/Antiquitäten kann nach §25a Abs. 3 UStG i.V.m.
Anlage 2 Nr. 49-53 UStG in bestimmten Fällen der ermäßigte Satz (7%) auf die Marge gelten. v1
rechnet einheitlich mit 19%, unabhängig von der gewählten Warenart. Ein UI-Hinweistext wurde
ergänzt (`lager/page.js`, `js/lager.js`, `rechnungen/js/rechnung.js` — Warenart-Dropdown/Select),
aber es gibt keine echte 7%-Berechnung.

**Risiko:** Kein §14c-Risiko (betrifft nie den Rechnungsausweis, nur die interne UVA-Zahllast).
Fehlerrichtung ist sicher: 19% statt 7% führt zu einer zu hoch erklärten Zahllast, nie zu einer
Untererklärung.

**Fix, falls nötig:** `satz`-Parameter warenartabhängig befüllen (`kunst`/`sammlerstueck` → ggf. 7%,
je nach Einzelfall), erst nach vertiefter Recherche der Anlage-2-Fälle. Dringlich nur, wenn Stackr
aktiv an Kunst-/Antiquitäten-Händler vermarktet wird — aktuelle Zielgruppe (Freelancer/GbR/
Gebrauchtwarenhandel) betrifft das kaum.

## 2. Retouren auf §25a-Positionen nicht gesondert verrechnet

**Wo:** `js/ustvoranmeldung.js` (`_istDiff25aSale`-Filter arbeitet nur auf `Store.getSales()`, nicht
auf `Store.getRetouren()`), `js/euer.js`/`js/gbr-modul.js` (gleiche Lücke in der informativen
Aufschlüsselung).

**Problem:** Wird ein regulär versteuerter Artikel zurückgegeben, zieht der bestehende
`retour19`/`retour7`-Mechanismus ihn korrekt vom Bruttoumsatz ab. Ein §25a-Artikel läuft nicht durch
diesen Pfad — er bleibt in der Marge-Berechnung der ursprünglichen Verkaufsperiode enthalten, auch
wenn er später zurückgegeben wird (es sei denn, der zugrunde liegende Sale wird selbst als
`storniert` markiert).

**Risiko:** Kein §14c-Risiko (kein Rechnungsausweis betroffen). Kann zu einer zu hoch ausgewiesenen
Marge/USt-Schuld führen, wenn die Retoure nach Einreichen der Periode erfolgt — wieder Richtung
Überzahlung, nicht Untererklärung.

**Fix, falls nötig:** §25a-Retouren analog zum bestehenden `retour19`/`retour7`-Mechanismus aus der
Marge herausrechnen (Lookup über `r.saleId` → verknüpfter Sale → verknüpfter Purchase →
`differenzbesteuert`-Flag). Dringlich nur für Nutzer mit regelmäßigen Rückgaben auf
differenzbesteuerte Artikel (z.B. Gebrauchtwaren-Händler mit Rückgaberecht) — für reine
Freelancer-Rechnungsstellung niedrige Eintrittswahrscheinlichkeit.

## Update 2026-07-22: echter Bug gefunden + gefixt (schwerer als Punkt 2 oben)

Bei der Suche nach Punkt 2 fiel auf: `Store.stornoSale()` setzt bei jeder verknüpften Retoure sofort
`storniert=true`, und `Store.getSales()` filtert Stornierte standardmäßig raus — der in Punkt 2
beschriebene Fall (Direktverkauf/Marktplatz-Retoure) war also schon vorher korrekt saldiert, nicht wie
im Text oben unterstellt.

Echtes Problem lag stattdessen bei **§25a-Gutschriften auf Rechnungspositionen**: In
`js/ustvoranmeldung.js` (Zeile ~96-103) wurde bei einer Gutschrift (`sign = -1`) nur der
`verkaufspreis` mit dem Vorzeichen multipliziert, der `einkaufspreis` blieb immer positiv. Bei der
Gesamtdifferenz-Methode (§25a Abs. 4) führte das zu einem doppelten Abzug des Einkaufspreises →
`neuerVortrag` wurde fälschlich negativ (Testrechnung: Verkauf 100/EK 50 + volle Gutschrift ergab
`neuerVortrag: -100` statt korrekt `0`) — das ist **Richtung Unterzahlung**, nicht Überzahlung wie bei
den beiden oben dokumentierten Punkten. Gefixt: `einkaufspreis: sign * (...)` in
`js/ustvoranmeldung.js`. Gleiches Muster (rein informativ, ohne Steuerwirkung) auch in
`js/euer.js` und `js/gbr-modul.js` korrigiert (dort verzerrte es nur die §25a-Anzeige-Kachel, nicht
den tatsächlichen Gewinn/USt).

Verifiziert per Node-Rechenkern-Test (`SteuerBerechnung.margeGesamtdifferenz`): vorher/nachher-Vergleich
bestätigt Fix.

Bei Einzeldifferenz (Standard-Methode) bleibt die strukturelle Lücke bestehen: eine Gutschrift kann
die in einer früheren Periode bereits gezählte positive Marge nicht rückwirkend korrigieren (Floor-bei-0
pro Position verhindert das) — das ist aber immer noch Richtung Überzahlung, kein neuer Risikofall, und
bräuchte ein Redesign (Korrektur am Ursprungs-Datensatz statt neue Position), nicht nur einen
Vorzeichen-Fix. Nicht angegangen, gleiche Priorität wie Punkt 1+2 oben.

## Nicht behandelt (bewusst, kein Blocker)

- Bulk-Einkauf/CSV-Import in `lager/page.js` haben keine §25a-UI bekommen (Flag defaultet auf
  `false`, im Edit-Modal nachträglich setzbar).
- Gesamtdifferenz-Vortrag wird nur beim expliziten "Als eingereicht markieren" in der UVA
  persistiert, nicht live — verhindert Verfälschung durch bloßes Seiten-Öffnen, bedeutet aber auch:
  wird eine Periode nie eingereicht, wird der Vortrag nie fortgeschrieben.

---

## fixes-eigenbeleg-gobd-2026-07-24.md

# Fixes — Eigenbeleg-GoBD-Audit-Log + Storno-Pattern (2026-07-24)

Commit: `9ee009e` — Eigenbeleg-GoBD-Audit-Log + Storno-Pattern, §33-UStDV-Vorsteuer-Einschraenkung,
Rechnungs-Rechtstext-Ergaenzungen

Quelle: `plan/session-prompt-gobd-eigenbeleg-auditlog.md` (Fund 1+2 aus dem GoBD-Audit vom 2026-07-23).

## 1. Eigenbeleg ohne Audit-Log (Fund 1)

**Problem**: `saveBeleg()`/`deleteBeleg()` in `eigenbelege/js/app.js` überschrieben bzw. löschten
Belege physisch, ohne jedes Protokoll. Kein `Store._addAuditEntry`-Aufruf im ganzen Modul.

**Fix**:
- `saveBeleg()` schreibt jetzt vor jeder Mutation einen Audit-Eintrag (`erstellt`/`bearbeitet`,
  alte+neue Werte, Hash-Chain — analog zu Rechnungen/Ausgaben in `js/store.js`).
- Bereits stornierte Belege sind nicht mehr bearbeitbar.
- `deleteBeleg()` löscht nicht mehr physisch, sondern setzt ein Storno-Flag
  (`storniert`/`storniertAm`/`stornoGrund`) — Beleg bleibt im Array erhalten.
- `purgeEigenbelegEverywhere()` (physisches Löschen über alle Firmen-Keys) bleibt nur noch als
  interne Funktion für manuelle Altlast-Bereinigung, ist nicht mehr über den Lösch-Button erreichbar.
- Storno-Belege bleiben in der Liste sichtbar (ausgegraut, "Storniert"-Badge), Edit/Delete-Buttons
  ausgeblendet, zählen nicht mehr in die Summen (Gesamt/Bar).

## 2. Nummernkreis-Reset bei "Alle löschen" (Fund 2 — schärfster Einzelfund)

**Problem**: `alleLoeschen()` setzte den Belegnummer-Zähler komplett zurück
(`eigenbelege_naechste_nummer` gelöscht) → Bruch der lückenlosen Nummernfolge, dazu Vernichtung
aller Belege ohne Log-Eintrag.

**Fix**:
- Zähler wird nicht mehr zurückgesetzt.
- Funktion storniert jetzt alle offenen (nicht gesperrten, nicht bereits stornierten) Belege statt
  sie zu löschen ("Massenstorno").
- Ein einzelner Audit-Eintrag mit Anzahl + Zeitpunkt wird geschrieben.

## 3. Folgefixe durch das neue Storno-Verhalten

Da stornierte Eigenbelege jetzt dauerhaft im Array bleiben (statt zu verschwinden), mussten zwei
Verbraucher-Stellen angepasst werden, die vorher blind das ganze Array gelesen haben:

- `rechnungen/js/rechnung.js` (Eigenbeleg-Auswahl beim Rechnung-Verknüpfen): filtert jetzt
  `storniert`-Belege raus.
- `js/protokoll.js`: neuer Label-Eintrag `eigenbeleg: 'Eigenbeleg'` für die Protokoll-Ansicht.

`js/euer.js` filterte `!b.storniert` für EÜR/Vorsteuer-Summen bereits vorher (aus einer parallelen
Session zum §33-UStDV-Vorsteuerfix) — keine Anpassung nötig.

## Nicht Teil dieses Fixes (separater Commit-Anteil, andere Sessions)

- §33-UStDV-Vorsteuerabzug-Einschränkung (`js/euer.js`, `js/gbr.js`) — eigene Session/Fund 3+6.
- Rechnungs-Rechtstext-Ergänzungen (Skonto-Hinweis, Geschäftsführer-Mehrfach-Hinweis §35a GmbHG,
  label-for-Verknüpfungen im Rechnungs-Protokoll) — eigene Session/Fund 4+5+7.

## Verifikation

- `node --check` auf allen 4 geänderten Dateien: clean.
- Node-Harness-Test: `Store._addAuditEntry`/`verifyAuditChain` mit `entityType: 'eigenbeleg'`
  durchgespielt (3 Einträge: erstellt, storniert, Massenstorno) — Hash-Chain valide
  (`{valid:true, broken:0, total:3}`).
- Kein Browser-E2E-Test (Whop-Gate blockt Login in Dev-Sessions, dev-server-Slot war durch
  Parallel-Session belegt). Empfohlener manueller Test bei Gelegenheit: Eigenbeleg anlegen →
  bearbeiten → Protokoll-Eintrag prüfen → löschen → Storno-Badge statt Verschwinden bestätigen.

## Akzeptanzkriterien (aus dem Fix-Auftrag) — Status

- [x] Eigenbeleg bearbeiten → Audit-Log-Eintrag mit alten Werten (Hash-Chain).
- [x] Eigenbeleg löschen (offene Periode) → Storno-Flag statt physischem Verschwinden, sichtbar
      (ausgegraut/gefiltert).
- [x] "Alle löschen" setzt den Zähler nicht mehr zurück, schreibt Massenstorno-Eintrag.
- [x] Export/Backup nimmt das Audit-Log automatisch mit (keine Code-Änderung nötig, Backup-Whitelist
      generisch).

---

## launch-prompts.md

# Launch-Prompts — Web 1.7 (Stand 2026-07-12)

Copy-paste-Prompts für alles, was vor dem Web-Launch noch offen ist.
Reihenfolge = Priorität. P0 = Launch-Blocker, P1 = launch-nah, P2 = kann nach Launch.

Jeder Prompt ist self-contained für eine frische Session gedacht.

---

## P0-1 · Uncommittete Trial-CTA-Änderungen verifizieren + committen — ✅ ERLEDIGT 2026-07-12 (Commits 655f428 + 25fcf6b; Session-CTA-Bugfix in landing.js, AGB-Vorschlag → plan/anwalt-notiz-trial-widerruf.md)

```
Im Repo Web 1.7 liegen uncommittete Änderungen an index.html und js/landing.js:
Die Pricing-CTAs wurden auf „Jetzt 7 Tage kostenlos testen →" umgestellt und
verlinken jetzt direkt auf die Whop-Checkout-Plan-Links
(plan_iR6YIKLcychSZ monatlich, plan_b5IBQ1lecggOT jährlich).

Aufgaben:
1. Lies den kompletten Diff (git diff index.html js/landing.js) und prüfe ihn auf
   Konsistenz: Stimmen beide Plan-Links? Ist der Monats/Jahres-Toggle weiter korrekt
   (11,25 €/Monat jährlich = 135 €, 15 €/Monat monatlich, inkl. MwSt.)?
2. Verifiziere im Browser (Preview-Server oder Edge — nie Chrome): Toggle umschalten,
   CTA-Text und href in beiden Zuständen prüfen, Konsole auf Fehler.
3. Prüfe, ob plan/trial-agb-diff-vorschlag.md noch gebraucht wird — die AGB/Widerruf-
   Trial-Anpassung wurde bereits committet (78ff1d5). Wenn der Vorschlag vollständig
   umgesetzt ist, verschiebe die offene Anwalts-Warnung (§ 356 Abs. 5 BGB, vorzeitiges
   Erlöschen des Widerrufsrechts) in eine kurze Notiz und lösche/archiviere die Datei.
4. Committe die Landing-Änderungen mit sauberer Message. NICHT deployen — macht der User.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im Ordner. Vor jedem
Edit die Datei frisch lesen; nur die eigenen Dateien stagen.

Akzeptanz: Diff verifiziert im Browser, committet, keine fremden Änderungen mitcommittet,
Status von trial-agb-diff-vorschlag.md geklärt.
```

---

## P0-2 · USt-Regelbesteuerung im Browser verifizieren (bisher ungetestet!) — ✅ ERLEDIGT 2026-07-13 (alle 5 Features browserverifiziert; 14 Bugs gefixt in 6c3220a + ecdfeee, u. a. RC-Automatik tot auf Standalone-Seite, Phantom-Vorsteuer, Retouren-Doppelabzug, DATEV verschluckte Direktverkäufe; Restliste → plan/ust-befunde-restliste.md, größter offener Punkt: Gutschriften mindern Umsatz nicht)

```
Im Repo Web 1.7 wurden am 2026-07-02 USt-Regelbesteuerungs-Features gebaut, die wegen
des Whop-Gates NIE im Browser getestet wurden: Soll/Ist-Versteuerungs-Schalter,
§14-UStG-Pflichtangaben-Sperre bei Rechnungen, Reverse-Charge-Automatik,
SKR-Konto-Badges und ein neues OSS-Modul.

Aufgaben:
1. Finde die betroffenen Module (grep nach Soll/Ist, Reverse-Charge, OSS, §14) und
   verschaffe dir einen Überblick über die Feature-Flächen.
2. Starte den Preview-Server und umgehe das Whop-Gate per geseedetem localStorage
   (gleiche Technik wie in plan/session-prompt-stb-luecken.md beschrieben — echtes
   Whop-Login geht im Preview nicht).
3. Teste jede Feature-Fläche im Browser: Schalter umlegen, Rechnung mit fehlenden
   §14-Angaben anlegen (muss blocken), Reverse-Charge-Fall durchspielen (EU-B2B),
   OSS-Modul öffnen und einen Eintrag anlegen, SKR-Badges sichtprüfen.
4. Rechenlogik: Lass den fn-checker-Agent die zentralen USt-Berechnungsfunktionen
   (UVA-Summen, Soll/Ist-Periodenzuordnung, RC-Netto-Ausweis) auf Logikfehler prüfen.
5. Gefundene Bugs direkt fixen, erneut verifizieren, committen.

Akzeptanz: Jedes der 5 Features einmal real im Browser durchgespielt, Screenshot-Beleg,
fn-checker-Befund dokumentiert, Fixes committet. Danach Memory-Eintrag
ust-regelbesteuerung-fixes.md auf „browserverifiziert" aktualisieren.
```

---

## P0-3 · Echter 2-Profil-Cloud-Sync-E2E-Test (mit mir zusammen)

```
Im Repo Web 1.7 ist der E2E-verschlüsselte Cloud-Sync live (api/sync.js + Upstash Redis
fra1). Mock-Tests bestanden, aber der echte Test mit zwei Browser-Profilen und echtem
Whop-Login steht noch aus — letzter offener Punkt vor dem Launch-Go für Cloud-Sync.

Aufgabe: Führe mich Schritt für Schritt durch den 11-Schritte-Testplan in CLOUD-SYNC.md.
Ich (der User) bediene die Browser-Profile in Edge, du sagst mir bei jedem Schritt genau,
was ich tun und was ich sehen soll, und wertest meine Rückmeldungen aus. Prüfe dabei
besonders: Push von Profil A → Pull auf Profil B, Konflikt-Fall (beide offline geändert,
4h-Grace-Logik), Art.-17-Löschung (Server-Daten wirklich weg), und dass im Netzwerk-Tab
nur Ciphertext (AES-GCM) übertragen wird, nie Klartext.

Falls ein Schritt fehlschlägt: Ursache im Code diagnostizieren, Fix vorschlagen, aber
nichts deployen ohne mein Go.

Akzeptanz: Alle 11 Schritte mit Ergebnis protokolliert (bestanden/gescheitert) in einer
kurzen Datei plan/cloud-sync-e2e-protokoll.md, Memory cloud-sync-e2e-verifikation.md
aktualisiert.
```

---

## P0-4 · Finaler Pre-Launch-QA-Sweep

```
/qa

Fokus auf die launch-kritischen Pfade der Web 1.7:
1. Kompletter Neukunden-Flow: Landing → Whop-Checkout-Link → (Gate) → Onboarding
   Firma anlegen → erste Einnahme → erste Rechnung → EÜR-Export.
2. Verschlüsseltes Backup erstellen + Restore (js/backup-crypto.js) — Roundtrip mit
   echten Daten aller Module (Lager, Fahrtenbuch, Eigenbelege company-präfixiert!).
3. GoBD-Pfade: festgeschriebenen Beleg stornieren (nie löschen), Periodensperre greift.
4. Datum-Handling: keine toISOString-Reste für Tagesdaten (Regel: toLocaleDateString('sv-SE')).
5. Offline-Grace: 4h-Grace nach Netzwerkverlust, Konflikt-Banner erscheint korrekt.

Alles was bricht: fixen, im Browser re-verifizieren, committen. Am Ende eine
Restliste „bekannt, aber nicht launch-blockierend" in plan/qa-restliste.md.
```

---

## P0-5 · Security-Finalcheck vor Launch

```
/security-stackr

Danach zusätzlich /red-team mit Fokus auf:
1. Whop-Gate-Umgehung: Kann man mit manipuliertem localStorage dauerhaft ohne Abo in
   die App (auch auf den Standalone-Seiten lager/rechnungen/eigenbelege, die erst
   2026-07-04 ans Gate angeschlossen wurden)? Grace-Stempel fälschbar?
2. api/sync.js: Kann User A an Daten von User B (fremde sub)? Rate-Limiting vorhanden?
   Können abgelaufene/gefälschte Whop-Tokens Grants anlegen oder pullen?
3. CSP-Stand nach PR#6 + Additiv-CSP-Drift-Fixes: noch inline-Handler-Reste, unsafe-*?
4. Secrets: keine Upstash/Whop-Keys clientseitig oder in Git-Historie der letzten Commits.

Kritische Funde sofort fixen + committen. Ergebnis als kurze Risiko-Tabelle
(Fund / Schwere / Status) — nur echte Funde, keine Theorie-Liste.
```

---

## P0-6 · Anwalts-Paket schnüren (Rechtstexte-Finalstand)

```
Im Repo Web 1.7: Die Anwalt-Freigabe für §11 AGB ist beauftragt aber offen, und die
neue Trial-Klausel (vorzeitiges Erlöschen des Widerrufsrechts, § 356 Abs. 5 BGB —
riskant bei Dauerschuldverhältnis, siehe frühere Analyse) muss in dieselbe Prüfrunde.
Whop-DPA/AV-Vertrag ist ebenfalls noch offen.

Aufgaben:
1. Lass den legal-reviewer-Agent den AKTUELLEN Stand von agb.html, refund.html,
   datenschutz.html und impressum.html komplett prüfen: Konsistenz untereinander
   (Trial überall gleich beschrieben? Whop als Merchant of Record überall korrekt?
   US-Datentransfer/SCC erwähnt?), fehlende Pflichtangaben, tote §-Verweise.
2. Erstelle ein 1-seitiges Anwalt-Briefing (plan/anwalt-briefing.md) mit:
   (a) den konkreten zu prüfenden Klauseln (Volltext-Zitate mit Fundstelle),
   (b) unseren offenen Fragen (§356-Abs.-5-Problem, §11-Haftung, Trial-Auto-Charge),
   (c) Fakten-Steckbrief: 15 €/M / 135 €/J, 7-Tage-Trial mit Auto-Charge, Whop als
   MoR (US, SCC), lokal-first-Datenhaltung, optionaler E2E-Cloud-Sync auf EU-Server.
3. Separater Abschnitt: Whop-DPA-Status — was genau fehlt uns von Whop (DPA/AVV,
   Subprozessor-Liste), wo beantragt man das, Formulierungsvorschlag für die Anfrage.

Nichts an den Rechtstexten selbst ändern ohne mein Go — nur Befund + Briefing.
```

---

## P1-1 · Steuerberater-Read-Only fertigbauen

```
→ Fertiger Prompt liegt bereits in plan/session-prompt-stb-luecken.md — 1:1 copy-pasten.
(Zwei Client-Lücken: StB ohne Abo durchs Login-Gate lassen + zweite Lücke laut Datei.
Branch feature/csp-phase-c. Nur nötig, falls StB-Feature zum Launch dabei sein soll —
laut Memory wartet es auf Kunden-Go.)
```

---

## P1-2 · Landing-Copy + technisches SEO-Minimum

```
/copy-marketing

Danach mit dem stackr-marketing-Agent:
1. Landing (index.html/landing.html): Wird der 7-Tage-Trial als primärer CTA klar?
   Offline-gratis vs. Web-Pro (15 €/M, 135 €/J, 45 € Ersparnis) in <10 Sek. verständlich?
   Cloud-Sync/überall-Zugriff als Web-Mehrwert sichtbar? 3 konkrete Verbesserungs-Diffs
   vorschlagen, nach meinem Go einbauen.
2. Technisches SEO-Minimum auf allen öffentlichen Seiten prüfen und fixen:
   <title>, meta description, genau ein <h1>, lang="de", Open-Graph-Tags, Canonical.
3. Keine erfundenen Claims, keine Steuerberatungs-Versprechen. Jede Zahl belegen
   oder rauslassen.

Akzeptanz: Diffs verifiziert im Browser (Edge/Preview), committet, kurze Vorher/Nachher-Notiz.
```

---

## P1-3 · Launch-Baseline messen (Juli Woche 1 aus dem Wachstumsplan)

```
Arbeite Woche 1 aus plan/2026-07-juli.md ab („Realität messen"):
Erstelle das 1-Seiten-Dokument plan/baseline-2026-07.md mit: geschätzte Offline-
Nutzerbasis (frag mich nach Download-Zahlen/Whop-Konten/E-Mail-Liste — ich liefere
die Zahlen), verfügbare Kontaktkanäle zu Bestandsnutzern, aktuelle zahlende Abos,
Trial-Starts, und die größte Funnel-Lücke. Abschluss-Einschätzung: Ist die
300-Abos-Ramp bis 31.12. realistisch oder muss plan/README.md angepasst werden?
Falls keine Analytics existieren: als Lücke notieren und das datenschutzfreundlichste
Minimal-Setup vorschlagen (kein Tracking-Consent-Monster, DSGVO-konform).
```

---

## P2-1 · Local 1.7 spiegeln + verwaistes Git reparieren

```
Der Ordner „Local 1.7" (Parallel-Variante von Web 1.7) hat ein verwaistes Git-Repo
und es besteht Parallel-Session-Risiko. Aufgaben:
1. Prüfe den Git-Zustand von Local 1.7 (verwaist seit wann, was fehlt) und repariere
   das Repo, ohne Arbeitsstände zu verlieren (vorher Sicherungskopie des Ordners).
2. Gleiche ab, welche Web-1.7-Fixes seit dem letzten Sync (2026-07-11, Icon/Onboarding-
   Fix) noch nicht in Local gespiegelt sind — insbesondere alles Committete seit
   13e20ab — und spiegle die relevanten (Local hat kein Whop-Gate/Cloud-Sync,
   also nur die geteilten Module).
3. Beachte die bekannten Sync-Regeln aus Memory stackr-project-layout.md.
Akzeptanz: Local-Git funktionsfähig, Sync-Stand dokumentiert, nichts überschrieben.
```

---

## P2-2 · Performance + Accessibility vor breiter Werbung

```
/performance-audit

Danach /accessibility. Beides mit Fokus auf die Landing + den Onboarding-Flow
(erste 5 Minuten eines Neukunden). Nur Maßnahmen mit Aufwand ≤ 1 Tag umsetzen,
Rest als priorisierte Liste in plan/perf-a11y-backlog.md. WCAG-Kontrast-Fixes
gab es schon (btn-success/btn-danger) — nicht doppelt fixen.
```

---

## Nicht-Prompt-Punkte (kann nur der User selbst)

- **Anwalt:** Briefing aus P0-6 an die Kanzlei geben, Freigabe §11 + Trial-Klausel abwarten.
- **Whop:** DPA/AVV bei Whop anfordern (Formulierung liefert P0-6).
- **Deploy:** Nach P0-1/P0-2/P0-4/P0-5 einmal deployen und Prod-Smoke-Test (Checkout war am 2026-07-11 schon E2E-verifiziert).

---

## launch-woche-2026-07-13.md

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

---

## ~~local-sync-backlog-2026-07-25.md~~ (alle 21 Punkte fertig, nur D6-Rechtstext offen, siehe plan/OFFEN.md §2.2/§6)

**⚡ Update 2026-07-27 (diese Session):** Verifiziert, dass frühere Parallel-Sessions bereits fast
alles aus Section B über Nacht/am Vormittag erledigt hatten (`js/euer.js`, `js/ustvoranmeldung.js`,
`js/oss.js`, `js/dashboard.js`, `js/ausgaben.js`, `js/kassenbuch.js`, `js/vorsteuer.js`,
`js/buchungen.js`, `js/rechtsform.js`, `js/afa.js`, `js/datev.js`, `js/gbr-modul.js`, `js/gbr.js`,
`rechnungen/js/rechnung.js`, `rechnungen/js/mahnungen.js`, `rechnungen/js/kunden.js`,
`rechnungen/js/rech-dashboard.js`, `rechnungen/js/xrechnung.js`, `rechnungen/js/wiederkehrend.js`,
`eigenbelege/js/app.js` B6, `js/companies.js` B29) — Rest-Diffs sind ausschließlich CH/AT (D1,
gewollt), CloudSync/`_syncReadRaw` (D2, Web-exklusiv) oder Eigenbelege-IndexedDB-Migration (D3,
"nicht akut"). Diese Session hat zusätzlich neu gemacht:
- `js/companies.js`: `migrateEigenbelegeToCompanies()` Kollisions-Hardening portiert (erste Firma
  gewinnt bei id-Kollision, bidirektionaler Link) — kleiner, echter Fund abseits der Backlog-Liste.
- `js/app.js`: **§25a-Einstellung (`differenzMethode` Einzel-/Gesamtdifferenz) fehlte komplett** im
  Local-Settings-Formular — `js/ustvoranmeldung.js` liest den Wert bereits, aber Nutzer konnten ihn
  nie setzen. UI-Block + Save-Handler ergänzt (B1 damit erst jetzt wirklich end-to-end).
- `js/app.js` restliche B21/B23/B24-Punkte (Diagnose-Export, Logo-500KB-Limit, Kassenbuch im
  Finanzen-Subnav, Teilzahlung) alle bereits vorhanden — keine weitere Aktion nötig.
- `css/style.css` (D8): Chart-Höhe/Legend/Touch-Targets bereits gefixt. Zwei Reste geprüft:
  (a) **Korrektur (Folge-Session 2026-07-27):** die hier notierte „`.mobile-menu-btn`-Media-Queries
  in Web sind vertauscht"-Beobachtung stimmt nicht — live getestet (375px → `flex`, 1280px →
  `none`), die zwei `@media`-Blöcke haben disjunkte Breakpoints (`max-width:768px` vs.
  `min-width:769px`), die Reihenfolge im Stylesheet ist damit für das Ergebnis irrelevant. Web ist
  nicht kaputt, der dafür angelegte Spawn-Task kann verworfen werden; Details unter Punkt 18/20;
  (b) `js/stb-share.js` (Steuerberater-Read-Only-Freigabe) existiert nur in Web, ganzes neues
  Feature, nicht im 29-Punkte-Backlog — bewusst nicht mitgezogen, eigener Punkt falls gewünscht.
- Section C (`js/steuer-berechnung.js`) + B2 (`js/bilanz.js` 0%-Satz-Bug) — bereits in dieser Session
  vorher erledigt (siehe Änderungsvermerk weiter unten im Originaltext).

**Folge-Session 2026-07-27 (nach diesem Update-Block): zwei echte Bugs in `js/app.js` gefunden und
gefixt**, unabhängig von B21/23/24 — `gewerbesteuer`/`lohnsteuer` fehlten komplett in der
`pages`-Map (Sidebar-Link auf diese Seiten war tot trotz vollständig portierter Module aus Punkt
14) und `GbR.isGbR()` statt `GbR.isPersonengesellschaft()` blendete den GbR-Tab für OHG/KG/GmbH &
Co. KG aus. Details + Browserverifikation unter Punkt 18 der Liste unten.

**Korrektur (Parallel-Session 2026-07-27, cross-session-message, verifiziert): B17 / Punkt 17 ist
KEIN offener Punkt und braucht KEINEN Rebuild.** Die obige Einschätzung („struktureller Rebuild,
eigene Session nötig") beruhte auf Vermutung, nicht auf Marker-Vergleich — der zeigt: `js/lager.js`
ist bis auf eine Härtungszeile (in Web gefixt, s. Punkt 17 unten) vollständig synchron, 0 CH-Marker,
0 Local-exklusive Zeilen. `lager/index.html` bleibt bewusst der 2667-Zeilen-Monolith (Locals CSP
erlaubt `'unsafe-inline'`, die Seite funktioniert) — der 2540→225-Split in Web ist reine
Architektur-Härtung ohne funktionalen Gewinn, kein Sync-Punkt.

**Alle 20 modul-/dateiweisen Punkte (1–21, B28 inklusive) sind damit abgeschlossen.** Einzig
Punkt 22 (D6 Rechtstext-Inhalt + zwei neue Nebenfunde: fehlendes `js/cookie-banner.js`, Paddle-
Live-Token in `lager/index.html`) bleibt offen — Details dort.

**Erledigt 2026-07-30: Local committet.** User hat den Commit freigegeben — `95c43d4` "Web-1.7-Sync:
Steuer-Berechnung, §25a-Settings, GoBD/USt-Fixes, Companies-Härtung" (52 Dateien, alle vorher per
`node --check` syntaxgeprüft). HEAD war `fba3222`, drei Tage 48+ Dateien uncommitted — das Risiko
ist damit weg.

**Neuer Punkt 23 (User-Entscheidung 2026-07-30: aufnehmen) — `js/stb-share.js` fehlt in Local.**
Steuerberater-Read-Only-Freigabe (Share-Link, externer Lesezugriff für den StB). Existiert nur in
Web, war nie Teil der ursprünglichen 29-Punkte-Liste, weil es kein Drift-Fund ist, sondern ein
komplettes Feature, das in Local nie gebaut wurde. Geprüft 2026-07-30: `body.stb-readonly` fehlt
in Locals `css/style.css` komplett (0 Treffer) — kein Teil-Rest, ganz sauber ungebaut. Braucht:
`js/stb-share.js` selbst, die CSS-Klasse `body.stb-readonly`, plus Wiring
in `app.html`/`js/app.js` (Read-Only-Banner, Share-Link-Erzeugung, Zugriffsprüfung beim Laden).
Umfang unklar, noch nicht gescoped — eigene Session zum Ausmessen des Diffs, dann entscheiden ob
1:1-Port sinnvoll ist oder Local-Anpassungen nötig sind (z.B. kein CloudSync-Backend für den
Share-Link-Transport, s. D2-Ausnahme — Web nutzt dafür vermutlich Vercel Blob/Upstash).

Verbleibend aus der ursprünglichen Liste: Punkt 21 (B28 Input-Härtung Local→**Web**, Gegenrichtung,
läuft nebenher), Punkt 22 (D6 Datenschutz/Impressum, Rechtstext-Problem, braucht `legal-reviewer`),
Punkt 23 (neu, `js/stb-share.js`, s. oben).

---

# Local-1.7-Sync-Backlog (Stand 2026-07-25, Original-Text unten unverändert als Referenz)

Vollständiger Drift-Audit Web 1.7 → Local 1.7 (Explore-Agent, `diff --strip-trailing-cr` über alle
geteilten Dateien + `git log -- <pfad>`-Zuordnung). Praktisch jede geteilte Datei unterscheidet
sich inhaltlich — die Drift ist nicht neu (nicht erst seit a76f6d1/76174bd/a95f9ed), sondern
strukturell und langjährig. Dies ist die Arbeitsliste — jeder Punkt wird einzeln abgearbeitet,
danach hier abgehakt/entfernt.

**Bekannte Ausnahmen (bewusst nicht Teil dieser Liste):** Whop/Cloud-Sync/api/-Infrastruktur
(Web-exklusiv), `js/license.js` (Local-exklusiv), `js/user-plan.js` (bewusst unterschiedlich:
Whop vs. Trial), CloudSync-Hooks in `js/store.js`.

---

## Section A — Aktuell uncommittete Web-Änderungen (noch nicht Teil des Backlogs)

`js/lager.js`, `js/store.js`, `js/protokoll.js`, `eigenbelege/index.html`, `lager/index.html`,
`rechnungen/index.html` sind in Web gerade in Arbeit (Lager-Refactor: `lager/index.html` von
Web als 224-Zeilen-Shell + `page.js` vs. Local monolithisch 2540 Zeilen). **Erst committen lassen,
dann diese Dateien neu abgleichen** — kein Feld-für-Feld-Diff auf unfertigem Stand.

---

## Section B — Fehlende Web-Commits/Features in Local (priorisierte Abarbeitung)

### 🔴 Kritisch — Steuer-/GoBD-Compliance-Risiko mit echtem Geld-/Rechtsbezug

- **B9 — Ist-Versteuerung zählt bezahlte Rechnungen nicht in UVA** (`js/ustvoranmeldung.js`):
  Local filtert `!s._invoiceId` heraus → bezahlte Rechnungsumsätze fehlen komplett in der
  Ist-UVA. Potenziell gravierende USt-Unterdeklaration.
- **B27 — DATEV verschluckt Direktverkäufe sobald ≥1 Rechnung im Jahr existiert**
  (`js/datev.js`): `if (invoices.length === 0)` statt Pro-Verkauf-Filter `!s._invoiceId`.
- **B8 — GbR: toter Store-Key `'ausgaben'` statt `'expenses'`** (`js/gbr-modul.js`):
  Betriebsausgaben in GbR-Gewinnverteilung immer 0. Direkte finanzielle Auswirkung auf
  Gesellschafter-Auszahlung. Plus: `js/gbr.js` `_calcMonthData()` rechnet brutto statt netto.
  Betrifft user-eigenes Steuersetup (GbR 50/50, s. [[steueragent-setup]]).
- **B6 — Eigenbelege: physisches Löschen statt Storno-Pattern** (`eigenbelege/js/app.js`):
  `deleteBeleg()` entfernt Belege unwiderruflich ohne Audit-Trail/Periodensperre-Prüfung. GoBD-
  Verstoß (§146 Abs.4 HGB). Web hat komplettes Storno-Pattern + Audit-Log + §162-AO-Katalog fürs
  VSt-Abzug-Häkchen.
- **B3 — isKlein-Snapshot pro Rechnung fehlt** (7 Dateien: `rechnung.js`, `dokumente.js`,
  `mahnungen.js`, `kunden.js`, `rech-dashboard.js`, `xrechnung.js`, `wiederkehrend.js`,
  `store.js`, `datev.js`): USt-Modus-Wechsel ändert rückwirkend MwSt auf bereits gestellten
  Rechnungen. §14-UStG-Verstoß.
- **B4 — Rechnungsnummer-Vergabe: Lückenlosigkeit + Race-Condition** (`js/store.js`):
  Local verbrennt Nummern bei jedem Formular-Öffnen (kein Peek/Save-Split), kein
  Web-Locks-Schutz gegen Parallel-Tab-Doppelvergabe, kein Jahreswechsel-Reset. §14 Abs.4 Nr.4
  UStG/GoBD.
- **B5 — Gutschriften (§17 UStG) fehlen durchgängig**: `store.js`, `euer.js`, `dashboard.js`,
  `datev.js`, `oss.js`, `ustvoranmeldung.js`, `statistiken.js` — Gutschriften mindern
  Bemessungsgrundlage nirgends korrekt.
- **B1 — §25a UStG Differenzbesteuerung fehlt end-to-end**: `store.js`, `euer.js`,
  `ustvoranmeldung.js`, `gbr-modul.js`, `lager.js`, `rechnung.js`. Komplettes Feature fehlt.
- ~~**B2 — SteuerBerechnung fehlt, 0%-Satz-Bug in bilanz.js**~~ — ERLEDIGT 2026-07-25 (s. Task 2+3
  unten). `parseFloat(x) || 19` mappte 0%-Sätze (steuerfreie EU-Verkäufe/Ausgaben) fälschlich auf
  19% (0 ist falsy in JS).
- **B22 — GoBD-Periodensperre-Warnung bei rückdatierten Buchungen fehlt** (`js/store.js`):
  `_warnIfPeriodLocked()` fehlt komplett, `isPeriodLocked()` prüft nur Quartale (nicht Monate).

### 🟠 Wichtig — funktionale Bugs, kein akuter Compliance-Bruch aber falsche Zahlen/UX

- **B11 — OSS-Schwellenwert-Fixes** (`js/oss.js`): kein Vorjahresvergleich, `>=` statt `>`,
  keine chronologische Laufsumme, falsche 0%-Stille bei unbekanntem EU-Land.
- **B12 — Kz.41/21-Aufteilung fehlt** (`js/ustvoranmeldung.js`): IG-Lieferungen vs. sonstige
  Leistungen nicht getrennt, Ist-Modus-EU-Warnhinweis fehlt.
- **B7 — Vorsteuer §14/§33 UStDV Beleg-Nachweis fehlt**: `_belegCheck()`/`_belegSummary()`,
  Lieferant-Felder in `buchungen.js`/`ausgaben.js`, IG-Erwerbsteuer-Gegenbuchung fehlt.
- **B10 — §141 AO Bilanzierungsschwelle fehlt** (`js/rechtsform.js`): komplette
  Schwellenlogik (800k€ Umsatz/80k€ Gewinn) fehlt.
- **B13 — GWG-Sofortabschreibung + degressive AfA-Jahressätze** (`js/afa.js`): Methode
  `sofort` fehlt, degressiver Satz pauschal 25% statt jahresabhängig gestaffelt (falsch für
  2024/2025+).
- **B15 — Künstlersozialabgabe (KSA)-Tracking fehlt** (`js/ausgaben.js`).
- **B16 — Gewerbesteuer §11 GewStG Abrundung fehlt** (`js/koerperschaftsteuer.js`).
- **B26 — Phantom-Umsatz bei leerer Menge** (`datev.js`, `oss.js`, `ustvoranmeldung.js`):
  `parseFloat(pos.menge || 1)` statt `parseFloat(pos.menge) || 0`.
- **B20 — Wareneinkauf bei storniertem Verkauf nicht ausgebucht** (`js/euer.js`).
- **B14 — Kassenbuch-Tagesgruppierung + Negativ-Warnung fehlt** (`js/kassenbuch.js`).
- **B21 — Teilzahlung-Fix (Dashboard offene Posten)** — `app.js`-Diff zu groß für Detailanalyse,
  gezielt nachprüfen.

### 🟡 Feature-Nachzügler (Lager, UI, Sonstiges)

- **B17 — Lager-Feature-Batch**: Warenkategorien/Status/Zielgruppen/Händler-Verwaltung,
  Mehrfarben-Feld, Storno-Freigabe-Reihenfolge-Fix, Artikelnummer-Stabilität.
- **B18 — Verzugszinsen §288 BGB** (`rechnungen/js/mahnungen.js`).
- **B19 — Artikelnummer-Stabilität bei Verkauf/Rechnung/Beleg** (`js/store.js`).
- **B23 — Diagnose-Export, Logo-Upload-Limit 500KB, differenziertes Backup-Reminder-System,
  differenzierte USt-Schwellen-Warnung** (`js/app.js`).
- **B24 — Kassenbuch fehlt im Finanzen-Sub-Nav** (`js/app.js`).
- **B25 — EÜR/UVA-Sub-Tab-Merge** (`js/euer.js`) — Local zeigt noch getrennte Sidebar-Einträge.
- **B28 — Diverse Input-Härtung** (breit gestreut, maxlength/max/Number.isFinite) — niedrige
  Priorität, sammelt sich am besten mit anderen Fixes in denselben Dateien ein.
  **Achtung, Drift läuft hier teils rückwärts:** in `js/bilanz.js` hat *Local* die Härtung und
  *Web* nicht (2026-07-25 festgestellt). Beim Modul-Durchgang jeweils in beide Richtungen prüfen,
  nicht blind Web→Local kopieren.
- **B29 — CSP Phase C Inline-Handler-Fix** (`js/companies.js`) — ACHTUNG: Local hat laut
  Section D bereits `script-src-attr 'none'` in der CSP, d.h. die alten Inline-Handler sind
  vermutlich schon jetzt stillschweigend kaputt.

---

## Section C — Komplett neue Datei, die in Local fehlt

- ~~**`js/steuer-berechnung.js`**~~ — ERLEDIGT 2026-07-25 (Datei + `<script>`-Tag in `app.html`).

---

## Section D — Entscheidungspunkte (kein einfacher "Fix", User-Entscheidung nötig)

- **D1 — CH/AT-Modul: Web hat es entfernt, Local hat es noch komplett aktiv.** Keine normale
  Drift-Richtung, sondern Gegenteil. Betrifft `schweiz.js`/`oesterreich.js`/`svs.js` (Web: Dateien
  liegen tot vor, nicht mehr `<script>`-eingebunden), `topnav.js`, `companies.js`
  (Länder-Onboarding), `app.js` (CH-Settings-Felder, Routing), `euer.js`/`ustvoranmeldung.js`/
  `oss.js` (CH-Sperrscreens), `dashboard.js`/`steuertermine.js` (SVS-Kachel/AT-Termine).
  **User-Entscheidung 2026-07-25: CH/AT bleibt in Local drin**, wird nicht entfernt, kein
  Sync-Punkt in dieser Runde. Siehe [[ch-at-removal-web]].
- **D6 — Datenschutz/Impressum beschreiben in BEIDEN Varianten falsche Architektur.** Web:
  Whop+Vercel Blob+Upstash. Local: Supabase+LemonSqueezy (tot, referenziert nicht-existentes
  `landing.html`). Local nutzt tatsächlich Trial+Offline-Lizenz (`license.js`) — keine der beiden
  Versionen passt. Eigenständiges Rechtstext-Problem, nicht einfach Web kopieren.
  **Sicherheitsfund nebenbei:** Local's Legal-Seiten haben komplett keine CSP-Meta-Tag (Web: sehr
  restriktiv `script-src 'none'`) — sollte unabhängig vom Rechtstext-Inhalt nachgezogen werden.

### Sonstiges (kein Fix nötig, nur zur Kenntnis)

- D2: CloudSync-Unterbau in `store.js` (`_deviceId()`, `_auditContentHash()`, `_syncReadRaw()`,
  `syncApplyKeys()`) — Web-exklusiv, ignoriert.
- D3: Eigenbelege IndexedDB (Web) vs. localStorage (Local) — Kapazitätsgrenze, nicht akut.
- D4: Local hat Supabase-Passwort-Reset-Handler in `app.html` — Altlast, Web hat das nicht.
- D5: Local's `index.html` ist 8-Zeilen-Redirect-Stub statt Marketing-Landingpage — vermutlich
  beabsichtigt, bitte bestätigen.
- D7: `lager/index.html` erst nach Web-Refactor-Commit neu abgleichen (s. Section A).
- D8: CSS — Chart-Höhe 220px vs 300px, ApexCharts-Legend-Fix fehlt, WCAG-Touch-Targets
  (`min-height:44px`) fehlen, alte Spinner-Hiding-Regel auf Mengenfeld noch in Local aktiv
  (macht Feld unbedienbar).
- D10: `js/actions.js` StB-Read-Only-Guard ist bereits durch `typeof`-Check abgesichert, in
  Local automatisch harmlos — kein Fix nötig.

---

## Vorgehen — Modul-weise Abarbeitung (User-Entscheidung 2026-07-25)

Nicht nach Priorität, sondern datei-/modulweise (weniger Kontext-Wechsel). Reihenfolge nach
Abhängigkeit: Fundament zuerst (store.js, steuer-berechnung.js), dann Module, die darauf aufbauen.

1. ~~**`js/store.js`**~~ — ERLEDIGT 2026-07-25, browserverifiziert. B4 (Rechnungsnummer Peek/Lock
   + Web-Locks-Schutz + Jahres-Reset + `wasAutoPreview`-Fix in `rechnungen/js/rechnung.js`,
   `wiederkehrend.js`, `dokumente.js` — async-Umstellung inkl. aller Aufrufer), B3 (isKlein-Snapshot,
   Store-Teil: `createStornoRechnung`/`createSaleFromInvoice` lesen/setzen `isKlein`; volles Setzen
   beim Rechnung-Erstellen bleibt Task 10), B5 (Gutschrift-Handling: `stornoSale`
   `_allowInvoiceLinked`-Guard + `buchungen.js`-Aufrufer, `createSaleFromInvoice`
   Vorzeichenumkehr+Steuersatz, `autoSyncInvoices` Gutschrift+Storno-Filter), B1 (§25a
   `getDifferenzVortrag`/`setDifferenzVortrag`, Store-Teil), B22 (GoBD-Periodensperre-Warnung
   `_warnIfPeriodLocked` in `savePurchase`/`saveSale`/`saveExpense`/`saveRechInvoice`), B19
   (Artikelnummer-Stabilität bei Edit), B17 (Lager-Store-Erweiterungen: Kategorien/Status/
   Zielgruppen/Händler + Storno-Freigabe-Reihenfolge-Fix in `deletePurchase`).
   Gefundener Zusatzbug beim Testen: `wasAutoPreview` fehlte zunächst → Zähler wurde nie verbraucht
   (jede neue Rechnung hätte RE-2026-001 vorgeschlagen). Live im Browser gefixt+verifiziert
   (RE-2026-001 → RE-2026-002 korrekt, Storno → SR-2026-0001 korrekt).
2. ~~**`js/steuer-berechnung.js`**~~ (neu, C) — ERLEDIGT 2026-07-25. Datei 1:1 kopiert (keine
   Web-exklusiven Abhängigkeiten) + `<script defer>`-Tag in Local `app.html` vor `js/euer.js`
   eingehängt (läuft damit auch vor `bilanz.js`).
3. ~~**`js/bilanz.js`**~~ — B2 ERLEDIGT 2026-07-25. `_calcGuV()` nettet jetzt über
   `SteuerBerechnung` statt eigener `parseFloat(x) || 19`-Arithmetik → 0%-Sätze (steuerfreie
   EU-Verkäufe/Ausgaben) werden nicht mehr auf 19% gemappt. Mitgekommen: unsynced bezahlte
   Rechnungen als Umsatz (inkl. §17-Gutschrift, kein Doppel-Netting), Retouren am Satz des
   verknüpften Verkaufs + kein Doppelabzug bei storniertem Verkauf, Wareneinsatz über `ustSatz`.
   **Gegen-Drift gefunden:** Local war bei der Input-Härtung in `bilanz.js` (maxlength/min/max/
   `Number.isFinite`) *voraus* — bewusst nicht überschrieben; gehört umgekehrt nach Web
   nachgezogen (s. B28-Notiz unten).
   Check: `SteuerBerechnung`-Rechenkern per Node-Assert verifiziert (0%-Fallback, §17-Gutschrift,
   Retouren-Satz, §25a Einzel-/Gesamtdifferenz) — alle grün.
4. ~~**`js/euer.js`**~~ — B1, B2, B5, B20, B25 ERLEDIGT 2026-07-26. Web-Stand übernommen, danach die
   zwei Local-Besonderheiten zurückgepatcht: CH-Sperrscreen in `render()` (vor den neuen Sub-Tabs,
   da im CH-Modus weder EÜR noch UVA sinnvoll sind) + gleiche Sperre als Früh-Return in `init()`;
   Eigenbeleg-Reads bleiben plain `localStorage` statt `Store._syncReadRaw()` (CloudSync ist
   Web-exklusiv). Verbleibender Diff zu Web = exakt diese Stellen, sonst identisch.
   Browserverifiziert (localhost:3345, echte Zahlen): Einnahmen je Satz genettet (1190@19 + 1070@7
   + 1000@0 → 3000, kein 19%-Pauschalfehler mehr), 0%-Einkauf erzeugt keine Vorsteuer, USt bläht
   den Gewinn nicht mehr auf, §17-Gutschrift mindert den Umsatz, Angebote zählen nicht mit,
   §25a-Aufschlüsselung korrekt (Umsatz 500 / EK 300 → Marge 200, USt 31,93).
5. ~~**`js/ustvoranmeldung.js`**~~ — B1, B5, B9, B12, B26 ERLEDIGT 2026-07-26. Gleiches Muster
   (Web-Stand + CH-Sperre zurück). Browserverifiziert: **B9 bestätigt gefixt** — Ist-Versteuerung
   zählt rechnungsverknüpfte Verkäufe jetzt mit (Testfall: 570 € USt statt vorher 190 €, also
   380 € Unterdeklaration auf diesem Datensatz). B12: Kz.41 (Ware) 800 € / Kz.21 (Leistung) 300 €
   sauber getrennt. B26: Position ohne Menge erzeugt keinen Phantom-Umsatz mehr (0 statt 1000 €).
   B25-UI mitgezogen: UVA-Sidebar-Link aus `Local 1.7/app.html` entfernt, `js/app.js` `onSteuer`
   um `onEuer ||` + `lohnsteuer`/`gewerbesteuer` ergänzt (Parität zu Web).
6. ~~**`js/gbr-modul.js` + `js/gbr.js`**~~ — B1, B8 ERLEDIGT 2026-07-26. Gegen-Drift beachtet:
   kein Blind-Copy, alle Local-Härtungen (`maxlength`, `min`/`max`, `Number.isFinite` für
   Hebesatz/Anteil/Betrag, `Utils.escapeHtml(b.typ)`/`(e.typ)`) sind erhalten geblieben, nur die
   Web-Verbesserungen einzeln portiert.
   `gbr-modul.js`: `_calcJahresgewinn` komplett neu (B8 `'ausgaben'`→`'expenses'` +
   SteuerBerechnung-Netting + Rechnungen/Gutschriften + Retouren + §25a-Aufschlüsselung),
   `isGbR()`→`isPersonengesellschaft()`, §141-AO-Hinweis, GewSt-Freiberufler-Guard, `rolle` in
   Anzeige + CSV, Handelsregister-Zeile im Export, Not-Available-Text.
   `gbr.js`: `taetigkeitsart`, `isPersonengesellschaft()`/`isKapitalgesellschaft()`/
   `hatGesellschafter()`, `rolle` (Feld, Select-Spalte, Speichern), `getKomplementaere()`/
   `getKommanditisten()`, Handelsregister-Felder + `_selectForm`-Toggles, `_selectTaetigkeitsart`,
   `berechneGewSt`-Rechtsform-Guard, `_calcMonthData` Netto-Umstellung (rechnete vorher immer
   brutto → bei Regelbesteuerung wurde die USt mit ausgezahlt).
   **Verifikation mit echten Zahlen** (Node-Assert-Harness + Browser localhost:3346):
   Kleinunternehmer 314,10 € Einnahmen / 23,80 € BA / 230,80 € Gewinn; Regelbesteuerung 290 / 20 /
   220 (0%-Verkauf bleibt 0%, kein 19%-Fallback); B8-Wächter: BA ≠ 0 und `Store.get('ausgaben')`
   wird nicht mehr aufgerufen; 50/50-Anteil 115,40 € statt vorher 127,30 € (= 11,90 € p.P. zu viel
   ausgezahlt). Alle vier GbR-Tabs + UVA + OSS + EÜR rendern fehlerfrei im Browser.
   **Web-Bug dabei gefunden (nicht in Local gefixt, um keine neue Drift zu erzeugen):** die
   `rolle`-Spalte wird als `<td>` gerendert, aber es gibt weder ein passendes `<th>` noch eine
   Zelle in `_addGsRow()` → Spaltenversatz bei OHG/KG/GmbH/UG/GmbH & Co. KG. Betrifft Web genauso;
   gehört dort gefixt und dann nach Local nachgezogen. GbR/eGbR (User-Setup) ist nicht betroffen.
7. ~~**`js/oss.js`**~~ — B5, B11, B26 bereits synchron (Stand 2026-07-26: einziger Diff zu Web ist
   der Local-exklusive CH-Sperrscreen, `_ueberSchwelleInvoiceIds()` u.a. vorhanden).
8. ~~**`js/dashboard.js`, `js/statistiken.js`**~~ — B5 ERLEDIGT 2026-07-26. `statistiken.js` 1:1
   von Web (keine Gegen-Drift), `dashboard.js` Web-Stand + zurückgepatchte SVS-Kachel
   (Local-exklusiv, D1). Browserverifiziert: `Statistiken._getFilteredData().unsyncedRevenue`
   liefert 300 € bei Rechnung 500 € / Gutschrift 200 € (§17 mindert korrekt, Angebot zählt nicht);
   Dashboard rendert fehlerfrei, weist Gutschriften als eigenen Typ aus, SVS-Kachel-Code erhalten.
   Mitgekommen: SRI-Hash + gepinnte ApexCharts-Version, Chart-Destroy vor Re-Render.
9. ~~**`js/datev.js`**~~ — B3, B26, B27 ERLEDIGT 2026-07-26. 1:1 von Web (keine CH-Sonderfälle,
   keine Local-Härtung in dieser Datei), Restdiff 0. **B27 browserverifiziert:** Testfall mit
   1 Rechnung + 2 Direktverkäufen im selben Jahr exportiert jetzt beide Direktverkäufe
   (110,00 € inkl. Käufer-Versand + 200,00 €) — vorher verschluckte der Guard
   `invoices.length === 0` sie komplett. Der rechnungsverknüpfte Verkauf (`_invoiceId`) wird
   korrekt NICHT doppelt gebucht. B5: Gutschrift als Soll-Buchung (59,50 €) statt Haben.
   B26: Angebot mit leerer Menge erzeugt keine Zeile.
10. **`rechnungen/js/*`** — B1, B3, B18. **5 von 7 Dateien erledigt 2026-07-26**, die zwei
    dicksten stehen noch aus (eigene Session empfohlen, s. unten).
    - ~~`xrechnung.js`~~ — B3: `isKlein` aus der Rechnung statt aus den Live-Settings.
    - ~~`kunden.js`~~ — B3 an zwei Stellen (Kundenumsatz + Dokumentenliste), dazu die a11y-
      Angleichung (`scope="col"`, `for=` an allen Labels). Locals `maxlength` blieb erhalten.
    - ~~`wiederkehrend.js`~~ — 1:1 von Web (kein CH, keine Local-Härtung). Bringt: **Datums-
      Überlauf-Fix** (`addMonthsClamped` — 31.01. monatlich ergab vorher den 03.03. statt
      28.02.), **Firmen-Scoping der Regeln** (lagen vorher im globalen Key
      `rech_recurring_rules`, also firmenübergreifend — dafür `getRechRecurringRules`/
      `saveRechRecurringRules`/`_migrateRechRecurringRules` in `js/store.js` ergänzt, Migration
      über `oyi_wk_migrated_v1`), `isKlein`-Snapshot, Lager-Verknüpfung wird ab der zweiten
      Wiederholung gekappt (sonst wird dasselbe Einzelstück mehrfach als verkauft gemeldet).
      Node-verifiziert: 31.01.→28.02., 31.05.→30.06., 29.02.2024 jährlich→28.02.2025,
      30.11.+Quartal→28.02., 31.08.+Halbjahr→28.02.; Regressionswächter gegen den alten Überlauf.
    - ~~`mahnungen.js`~~ — **B18 Verzugszinsen §288 BGB** (Basiszinssatz §247 BGB, in den
      Rechnungsbuch-Einstellungen überschreibbar, Fallback 1,52%; B2B +9 / B2C +5 Prozentpunkte
      per Heuristik über das Firmenfeld), Mahnfristen als Datenwerte statt im Fließtext
      hartcodiert, `isKlein`-Snapshot, Teilzahlungen mindern Mahn-/Zinsgrundlage,
      Fälligkeits-Guard gegen leeres `faelligkeit`, „Als bezahlt" läuft über
      `Dokumente.showBezahltModal` (mit `typeof`-Guard, greift erst nach dem dokumente.js-Port).
      Browserverifiziert: Modul lädt, Basiszins-Feld rendert mit 1,52 und liest aus dem Store.
    - ~~`rech-dashboard.js`~~ — 1:1 von Web (in Local-HEAD nachweislich kein CH-Code). Bringt
      Vor-Fälligkeits-Hinweis (≤3 Tage), Teilzahlungs-Restbetrag in der Liste und die
      E-Rechnungs-Pflichtmeldung nur noch für `land === 'DE'` (CH/AT-tauglich).
    - ~~`dokumente.js`~~ — 1:1 von Web (kein CH-Code), danach Locals `maxlength="300"` am
      Storno-Freitext zurückgesetzt. Webs Härtung am EK-Feld (`min="0" max="99999999"`) ist
      strenger als Locals und wurde übernommen. Exportiert jetzt auch `showBezahltModal`, womit
      der `typeof`-Guard in `mahnungen.js` greift.
    - ~~`rechnung.js`~~ (705 Diffzeilen) — **ERLEDIGT 2026-07-27.** Vorgehen umgekehrt zum
      erwarteten: statt 40 Hunks von Hand zu portieren (fehleranfällig bei Steuercode) wurde die
      Web-Datei kopiert und danach die Local-exklusiven Teile gezielt zurückgepatcht — die
      CH-Stellen waren vorher vollständig enumeriert (7 Codestellen + 4 `maxlength` + Eigenbeleg-
      Read). Prüfung vorab: von allen 17 `Store.*`-Aufrufen der Web-Datei fehlt in Local nur
      `_syncReadRaw` (D2/D3) — alles andere inkl. `peekRechInvoiceNumber`/`nextRechInvoiceNumber`
      ist durch Punkt 1 vorhanden.
      Neu in Local: §25a-UI (Checkbox + Warenart-Select + EK-Feld, MwSt-Spalte weicht „Diff. §25a"),
      `isKlein`-Snapshot durchgängig, Lager-Picker mit Filtern/Vorschaubild + Sofort-Verkauft-
      Markierung + `reconcileLagerOnCancel`, §13b-`igArt` pro Position (Kz.41 vs. Kz.21),
      §14-Pflichtangaben **blockieren** jetzt das Speichern statt nur zu warnen, Cent-Rundung
      je Zeile, §25a-Pflichthinweise im PDF, Leistungsdatum-Fallback, Print-Umbruchregeln,
      Kunden-Autocomplete, E-Rechnungs-Hinweis, a11y (`for=`/`aria-label`/`scope="col"`).
      CH zurückgepatcht über zwei neue Helper statt 6 Inline-Ternaries: `resolveIsKlein()`
      (Snapshot hat Vorrang, sonst `chMwstMode` im CH-Modus) und `defaultMwstSatz()`.
      **2 Local-eigene Bugs dabei gefunden und gefixt** (kommen nicht aus Web):
      (a) `parseInt` auf dem MWST-Satz im Produkt-Modal schnitt die CH-Sätze 8.1/2.6/3.8 auf
      8/2/3 ab → zu niedrig ausgewiesene MWST; (b) der `: 19`-Fallback beim Produkt-Einfügen ist
      im CH-Modus kein gültiger Option-Wert, das Select fiel still auf 0% zurück.
      **Browserverifiziert** (localhost:3344): DE-Modus 19/7/0 + Nummernfolge RE-2026-001 →
      RE-2026-002 (Zähler wird verbraucht, `wasAutoPreview` aus Punkt 1 greift); §25a-Haken
      blendet den USt-Ausweis aus (200 € netto + 38 € USt → 200 € ohne USt) und zeigt das
      EK-Feld; CH-Modus 8.1/2.6/3.8 mit Default 8.1, Label „MWST", CHF-Formatierung,
      1.000 € → 81,00 € MWST (mit dem alten `parseInt` wären es 80,00 € gewesen);
      Speichern im CH-Modus ohne dt. Steuernummer wird nicht mehr fälschlich blockiert;
      `isKlein: false` landet als Snapshot in der Rechnung, `mwstSatz: 8.1` unverfälscht.
      PDF in allen vier Kombis korrekt: CH/regel → MWST-Nr. statt Steuernr., CH/klein →
      „Art. 10 Abs. 2 MWSTG", DE/regel → Steuernr. + „MwSt. 19%", DE/klein → „§19 UStG".
      Keine Konsolenfehler. (Der vorgesehene Prompt `plan/session-prompt-local-rechnung-js.md`
      wird damit hinfällig.)

10b. **Teilzahlungs-Feature nachgezogen — ERLEDIGT 2026-07-26.** War **nicht Teil des Audits**
    (Web-Commit `d3d7fdc` entstand danach), Local kannte das Feature gar nicht.
    User-Entscheidung 2026-07-26: komplett nachziehen. In `js/store.js` ergänzt:
    `addRechTeilzahlung()` (eigener Save-Pfad an `_isRechInvoiceLocked` vorbei, weil eine
    Teilzahlung keine §14-Pflichtangabe ändert — sonst wäre die Erfassung für jede *versendete*
    Rechnung dauerhaft blockiert), `opts`-Parameter in `createSaleFromInvoice` mit
    Teilzahlungs-Zweig (anteiliger Sale zum tatsächlichen Zahlungsdatum, kein EK-Bezug) und
    Abzug bereits erfasster Teilzahlungen bei der Schlusszahlung, sowie Storno-Kaskade über
    **alle** verknüpften Sales statt nur den ersten (`filter` statt `find`).
    Browserverifiziert (localhost:3349, In-Memory-Stubs, nichts persistiert): Rechnung 1.190 €,
    Teilzahlungen 300 € am 20.12.2026 und 400 € am 28.12.2026, Schlusszahlung 15.01.2027 →
    Dezember-Zufluss 700 €, Januar-Zufluss 490 €, Summe exakt 1.190 € ohne Doppelzählung
    (§11 EStG). Teilzahlung auf bereits bezahlte Rechnung wird abgelehnt. Storno der Rechnung
    storniert alle drei Sales — vorher wären die beiden Teilzahlungs-Sales als Einnahme in
    EÜR/Bilanz stehengeblieben.
11. ~~**`js/vorsteuer.js`, `js/buchungen.js`, `js/ausgaben.js`**~~ — B7, B15 ERLEDIGT 2026-07-26.
    Wie bei Punkt 6 kein Blind-Copy: in allen drei Dateien ist Local bei der Härtung voraus
    (`maxlength`, `min`/`max`, `Number.isFinite`, Negativ-Betrag-Guards in Einkauf-/Verkauf-/
    Ausgaben-Edit) — komplett erhalten, nur die Web-Features portiert.
    `vorsteuer.js` (B7): `_belegCheck()`/`_belegSummary()`, Beleg-Ampel-Spalte in Einkaufs- und
    Ausgaben-Tabelle, Beleg-Nachweis-Karte, IG-Erwerbsteuer-Gegenbuchung (`erwerbsteuer = vst`
    beim manuellen `ig_erwerb`-Eintrag, §1a UStG — ohne das zog die UVA nur Kz. 61 ohne
    gegenläufige Kz. 89), `Kz. 66`-Label entfernt. **Zusätzlich zwei echte Rechenfehler
    mitgefixt:** `_calcFromPurchases` las `steuersatz` statt `ustSatz` (Einkäufe tragen `ustSatz`
    → Satz wurde faktisch immer als 19% behandelt) und 0% fiel per `||` auf 19% zurück
    (Privatankauf erzeugte Phantom-Vorsteuer); `_calcFromExpenses` hatte denselben `||`-Fehler,
    wodurch der 0%-Zweig unerreichbar war.
    `ausgaben.js` (B15 + B7): KSA-Kategorie „Honorare an Künstler/Publizisten", `_KSA_SATZ` 4,9%,
    `_KSA_BAGATELLGRENZE` 1.000 €, `_ksaJahressumme()`, KSA-KPI-Kachel, Live-Hinweis im Formular
    (Freigrenze, nicht Freibetrag — bei Überschreiten ist die *gesamte* Jahressumme pflichtig,
    §24 Abs.3 KSVG), Lieferant-/Steuernr.-Felder + Beleg-Foto in Anlegen und Bearbeiten,
    `Store.isPeriodLocked()` → `!Store.canEdit()`.
    `buchungen.js` (B7): Lieferant-/Steuernr.-Felder auf Session-Ebene (eine Einkaufsquelle = ein
    Beleg) inkl. Persistenz an jeden Purchase, dieselben Felder + Beleg-Foto im Einkauf-Bearbeiten,
    `Gutschrift` als eigener Typ in der Buchungsliste. Die Preis-/Anzahl-Validierung wurde
    zusammengeführt statt ersetzt: Webs `Number.isFinite` + Obergrenze übernommen, Locals
    `anzahl >= 1` behalten (Web erlaubt dort 0).
    **Browserverifiziert** (localhost:3346, eigener Port): §33-UStDV-Grenze trennt exakt bei 250 €
    (250,00 € = Kleinbetrag/OK, 250,01 € = Steuernr. Pflicht), Lager-Feld `haendler` und
    Ausgaben-Feld `lieferant` werden als Aussteller akzeptiert, Beleg-Karte zeigt „2 von 3" mit
    Warnfarbe, Ampel-Spalte 1× ✅ / 1× ⚠️. Vorsteuer-Rechenkern: 0%-Einkauf → 0 € VSt (vorher
    15,97 €), Altdaten ohne `ustSatz` → weiterhin 19%-Fallback, 7% → `vst7`, 0%-Ausgabe → `vst0`
    statt Abzug. KSA: 1.200 € Honorar → 58,80 € auf die volle Summe, exakt 1.000 € → frei.
12. ~~**`js/rechtsform.js`**~~ — B10 ERLEDIGT 2026-07-26 (vorgezogen, weil `euer.js` `Rechtsform.
    brauchtBilanzStattEuer()` braucht). Web-Diff war rein additiv, Datei 1:1 kopiert:
    `FORMEN_MIT_TAETIGKEITSART`, `getTaetigkeitsart()`, `istGewerblich()`, §141-AO-Schwellen
    (800k€/80k€) inkl. `ueberschreitetAO141Schwelle()`/`brauchtBilanzStattEuer()`, Freiberufler-
    Ausnahme in `brauchtGewSt()`. `GbrModul._calcJahresgewinn` ist in Local vorhanden, die
    Schwellenprüfung ist zusätzlich per `typeof`-Guard abgesichert.
13. ~~**`js/afa.js`**~~ — B13 ERLEDIGT 2026-07-26. GWG-Sofortabschreibung (§6 Abs.2 EStG): neue
    Methode `sofort` mit voller AK im Anschaffungsjahr und *ohne* Monatsregel, Auswahl im Formular
    + Hinweistext, Nutzungsdauer-Feld wird dabei gesperrt, Auto-Vorschlag bei AK ≤ 800 € (nur
    solange der Nutzer die Methode nicht selbst gesetzt hat), Speicher-Guard „nur bis 800 € netto",
    Tabellen-Label „Sofort (GWG)". Degressive Sätze sind jetzt anschaffungsjahr-abhängig statt
    pauschal 2,5×/25%: 2020–2022 2,5×/25%, 2024 2,0×/20%, 2025–2027 3,0×/30%, sonst konservativ
    2,0×/20%. `Store.isPeriodLocked()` → `!Store.canEdit()`.
    Verifiziert (Node-Assert + Browser localhost:3347): GWG 800 € bei Novemberkauf → volle 800 €
    im Kaufjahr, 0 € im Folgejahr; degressiv 2021 → 2.500 €, 2024 → 2.000 €, 2026 → 3.000 €
    (vorher lieferten *alle* Jahre 2.500 €); lineare Monatsregel unverändert (Julikauf 12.000 €/5J
    → 1.200 €). Regressionswächter gegen den alten Pauschalsatz liegt im Check.
14. ~~**`js/koerperschaftsteuer.js`**~~ — B16 ERLEDIGT 2026-07-26. §11 GewStG: Gewerbeertrag wird
    vor der Steuermesszahl auf volle 100 € abgerundet (`Math.floor(max(0,zvE)/100)*100`), vorher
    rechnete der Messbetrag direkt auf dem ungerundeten zvE. Verifiziert: zvE 10.099 € → Ertrag
    10.000 € → Messbetrag 350 € → GewSt 1.400 € bei Hebesatz 400%, identisch zu zvE 10.000 €;
    negativer zvE ergibt 0 statt negativem Ertrag.
15. ~~**`js/kassenbuch.js`**~~ — B14 ERLEDIGT 2026-07-26. Tagesabschluss-Zeile je Datumswechsel
    (Tagessumme Ein/Aus + laufender Saldo) und Warn-Toast, wenn eine Buchung den Kassenbestand
    negativ machen würde (ein negativer Kassenbestand ist bei Betriebsprüfungen ein klassischer
    Beanstandungsgrund). Verifiziert: 3 Einträge über 2 Tage erzeugen genau 2 Tageszeilen
    („01.03.2026: +50,00 € / −20,00 €" und „02.03.2026: +0,00 € / −30,00 €").
    Locals strengere Anfangsbestand-Validierung (`Number.isFinite` + Ablehnung negativer Werte)
    wurde behalten — Web setzt dort still auf 0.
16. ~~**`eigenbelege/js/app.js` + `js/protokoll.js`**~~ — B6 ERLEDIGT 2026-07-27.
    B6 selbst war bereits synchron (Storno-Pattern statt physischem Löschen, `storniert`-Flag,
    `isPeriodLocked`-Prüfung — Marker-Counts in Web und Local identisch).
    `protokoll.js`: Restdiff ist **ausschließlich** der Cloud-Anker (`CloudSync.verifyAuditAnchors`)
    — Web-exklusiv nach D2, kein Fix nötig. Local behält die rein lokale Hash-Ketten-Prüfung.
    `eigenbelege/js/app.js`: Restdiff ist D3 (IndexedDB-Cache via `_ebRead`/`_ebWrite` in Web vs.
    plain `localStorage` in Local — bewusst, Local hat kein `Store._syncReadRaw`) plus Local-
    voraus bei `maxlength`. **3 Zusatzfunde gefixt:**
    (a) Der Schalter „Nummernkreis jährlich zurücksetzen" war in Local **tot** — die Checkbox
    `s-reset` wurde gerendert und gespeichert, aber `getNextNum()` las `jahresReset` nie aus, der
    Kreis sprang immer aufs Jahr zurück. Wer fortlaufend nummerieren wollte, konnte es nicht.
    (b) `esc()` escapte `'` nicht (Web schon) → XSS-Lücke überall dort, wo interpolierte Werte in
    Single-Quote-Attributen landen.
    (c) `eigenbelege/index.html` lud **7 CDN-Ressourcen ungepinnt und ohne SRI** (`apexcharts@3`,
    `notyf@3` js+css, `flatpickr@4` js+css+l10n, `gsap` ohne `integrity`) — Supply-Chain-Risiko,
    in einer Offline-First-Variante besonders unschön. Jetzt auf Webs exakte Versionen gepinnt
    inkl. `integrity`/`crossorigin`. Locals self-hosted Tabler-Fonts wurden bewusst **nicht** durch
    Webs CDN-Variante ersetzt (s. [[icon-onboarding-silent-fail-fix]]).
    Browserverifiziert: alle Libs laden (bei falschem Hash würde der Browser sie blocken),
    `flatpickr.l10ns.de` vorhanden, `esc("a'b<c")` → `a&#39;b&lt;c`, keine Konsolenfehler.
    **Nicht angefasst (braucht User-Entscheidung):** `eigenbelege/index.html` lädt weiterhin
    `cdn.paddle.com` + `Paddle.Initialize(token)`, und `js/user-plan.js` ruft real
    `Paddle.Checkout.open()`. Paddle gilt laut [[whop-stack-migration]] als tot, ist in Local aber
    noch verdrahtet — `user-plan.js` steht zudem oben explizit auf der Ausnahmeliste. Gehört zu D6,
    nicht zu diesem Sync-Punkt. Betrifft auch `lager/index.html` und `rechnungen/index.html`.
17. ~~**`js/lager.js`** (Rest)~~ — ERLEDIGT/synchron, per Marker-Vergleich bestätigt (Parallel-
    Session 2026-07-27, cross-session-message): 0 CH-Marker, 0 Local-exklusive Zeilen, die 347
    Diffzeilen waren komplett Härtung. Web-Fund dabei: die einzige Härtung, die Local voraus war
    und Web fehlte — `isNaN(newVal)` statt `!Number.isFinite(newVal)` in `Web 1.7/js/lager.js:2223`
    (`isNaN(Infinity) === false`, ließ `Infinity` als EK-Wert durch) — in Web gefixt, verifiziert.
    **`lager/index.html` bewusst NICHT umgebaut:** Locals CSP hat `'unsafe-inline'` in
    `script-src`, die 4 Inline-Blöcke laufen, die Seite ist nicht kaputt. Der 2540→225-Zeilen-Split
    (Shell + `page.js`) in Web ist reine Architektur-Härtung ohne funktionalen Gewinn — kein
    struktureller Rebuild nötig, damit auch keine eigene Session mehr erforderlich (widerspricht
    der Einschätzung zweier Vorsessions weiter oben, die von einem nötigen Rebuild ausgingen).
18. ~~**`js/app.js`**~~ — B21, B23, B24 bereits von Vorsession bestätigt vorhanden (s. Update-Block
    2026-07-27 oben). **Zusätzlicher Fund + Fix in dieser Fortsetzungs-Session (2026-07-27,
    unabhängig von B21/23/24):** Zwei echte, bis dahin unentdeckte Bugs in der Rechtsform-
    basierten Sidebar/Navigation, aufgefallen beim Live-Testen (nicht aus dem ursprünglichen
    29-Punkte-Katalog):
    (a) `_updateGbrTabVisibility()` blendete nur `kstSidebarLink`/`bilanzSidebarLink` nach
    `Rechtsform.getConfig()` ein — `lohnsteuerSidebarLink` und `gewstSidebarLink` stehen in
    `app.html` per Default auf `display:none` und wurden **nie** wieder eingeblendet. Jede
    Rechtsform mit Gewerbesteuer- oder Lohnsteuerpflicht (z.B. GmbH) hatte dadurch keinen
    erreichbaren Menüpunkt zu diesen Modulen, obwohl `js/gewerbesteuer.js`/`js/lohnsteuer.js`
    seit Punkt 14 vollständig portiert vorliegen. Auf den vollen `show()`-Helfer mit allen
    sechs Links umgestellt (kst/bilanz/lohnsteuer/gewst/privatbuchungen/ksk).
    (b) **Schwerer:** `gewerbesteuer`/`lohnsteuer` fehlten komplett in der `pages`-Map von
    `js/app.js` — `App.navigate('gewerbesteuer')` traf sofort auf `if (!this.pages[page]) return;`
    und tat gar nichts. Der Sidebar-Link wäre also selbst nach Fix (a) tot geblieben. Beide
    Page-Objekte ergänzt (`lohnsteuer: Lohnsteuer, gewerbesteuer: Gewerbesteuer,`).
    Nebenbei: `GbR.isGbR()` (nur GbR/eGbR) → `GbR.isPersonengesellschaft()` (GbR/eGbR/OHG/KG/
    GmbH & Co. KG, an beiden Call-Sites) — Personengesellschaften jenseits der reinen GbR
    konnten den GbR-Tab bisher gar nicht öffnen, obwohl `js/gbr-modul.js` sie seit Punkt 6
    schon inhaltlich unterstützt. Zusätzlich das fehlende Rechtsform-Navigations-Gate ergänzt
    (blockt Direktnavigation zu gesperrten Seiten, analog zum bestehenden AT-Land-Gate).
    **Browserverifiziert** (Port 3344, `fetch(...+Date.now())` gegen den `http.server`-Cache):
    Einzelunternehmen sperrt `gewerbesteuer`/`koerperschaftsteuer`/`lohnsteuer` korrekt zurück auf
    Dashboard; GmbH erreicht alle drei; OHG zeigt jetzt den GbR-Tab. Keine Konsolenfehler.
    **Korrektur zur Notiz oben:** die dort erwähnte „Web-Queries sind vertauscht"-Beobachtung zu
    `.mobile-menu-btn` stimmt nicht — live in Chrome/Browser-Pane getestet (375px → `flex`, 1280px
    → `none`), die beiden `@media`-Blöcke haben disjunkte Breakpoints (`max-width:768px` vs.
    `min-width:769px`), die reine Reihenfolge im Stylesheet ist für das Ergebnis irrelevant. Web ist
    nicht kaputt; der zuvor dafür angelegte Spawn-Task für Web kann verworfen werden.
19. ~~**`js/companies.js`**~~ — B29 bereits von Vorsession erledigt (s. Update-Block 2026-07-27 oben).
    **Ergänzt (Parallel-Session 2026-07-27, cross-session-message, verifiziert):** Cleanup-Schleife
    beim Firmen-Löschen (`localStorage.key(i)` rückwärts, alle Keys mit Firmen-Präfix entfernen) —
    fehlte bisher, in Local schwerer als in Web, weil Eigenbelege dort direkt im localStorage
    liegen statt in IndexedDB: Belegdaten einer gelöschten Firma blieben sonst dauerhaft erhalten
    (Art. 17 DSGVO). `CloudSync.deleteRemote` bewusst nicht mitportiert (Web-exklusiv).
20. ~~**`css/style.css`**~~ — D8 ERLEDIGT 2026-07-27. Portiert: WCAG-Kontrastwerte für
    `--text-muted` (dark `#71807a`→`#7d8c86`, light `#84908a`→`#5f6b65` — beides die in Web
    auditierten Werte), Chart-Höhe 300px→220px, ApexCharts-Legend-Fix (Marker sprengte sonst die
    Zeilenhöhe), `.mobile-menu-btn { display:flex }` unter 768px (fehlte komplett — nur die
    `min-width:769px`-Gegenregel war da), WCAG-2.5.5-Touch-Targets `min-height:44px` auf
    `.btn`/`.btn-sm` im Mobile-Block.
    **Bewusst NICHT portiert:** der `body.stb-readonly`-Block — `js/stb-share.js` existiert in
    Local nicht, das CSS wäre toter Code.
    **D8-Notiz war falsch:** „alte Spinner-Hiding-Regel auf dem Mengenfeld noch in Local aktiv,
    macht Feld unbedienbar" stimmt nicht — die Regel (`-moz-appearance:textfield` +
    `::-webkit-*-spin-button{appearance:none}` auf `.wp-menge`/`.wp-preis`) hat **Web**, Local hat
    sie gar nicht. Sie macht ein Feld auch nicht unbedienbar, sie blendet nur die Pfeilchen aus.
    Da es einen Nutzerhinweis in die Gegenrichtung gibt, bewusst nicht nach Local gezogen — falls
    die Pfeile in Local stören, ist das der Einzeiler dafür.
    Browserverifiziert über `fetch('css/style.css?cb=…')` (Cache-Buster, da `http.server` keine
    No-Cache-Header schickt): alle fünf Änderungen im ausgelieferten Stylesheet, `stb-readonly`
    korrekt abwesend.
21. ~~B28 (Input-Härtung)~~ — laut Marker-Vergleich (Parallel-Session 2026-07-27) über alle 11
    betroffenen Dateien ausgeglichen (maxlength/Number.isFinite gleichauf zwischen Web und Local),
    bis auf die eine `lager.js`-Zeile, die jetzt unter Punkt 17 gefixt ist. Kein offener Rest.
22. D6 (Datenschutz/Impressum) — Inhaltsteil weiterhin offen (eigenständiges Rechtstext-Problem,
    Local beschreibt Supabase+LemonSqueezy, nutzt real Trial+Offline-Lizenz; Anwalts-/User-
    entscheidung, mit `legal-reviewer` angehen). Der Sicherheitsfund (fehlender CSP-Meta-Tag) ist
    **erledigt** — Parallel-Session 2026-07-27 hat `datenschutz.html`/`impressum.html` einen CSP
    ergänzt (`script-src 'self'` statt Webs `'none'`, weil beide Seiten `js/cookie-banner.js`
    laden), verifiziert.
    **Cookie-Banner — ERLEDIGT 2026-07-28 (Local soll mit Web-Import-Button gelauncht werden,
    User-Entscheidung: mirror statt Script-Tag entfernen, da die Rechtsseiten sonst ganz ohne
    Consent-Mechanismus dastünden):** `js/cookie-banner.js` war der ursprüngliche Fund — existierte
    in Local gar nicht, obwohl beide Rechtsseiten es luden (toter `<script>`-Tag). Byte-identisch
    aus Web gespiegelt (CRLF wie der Rest von Local, sonst identisch). Dabei einen **zweiten,
    schwereren Bug in derselben Kette gefunden**: `js/actions.js` (der zentrale `data-action`-
    Click-Router) fehlte auf `datenschutz.html`/`impressum.html` komplett — selbst mit der Datei
    an Ort und Stelle hätte der "Verstanden ✓"-Button nie reagiert, weil nichts den Klick auf
    `data-action="cb-accept"` abgefangen hätte. `js/actions.js` vor `js/cookie-banner.js` ergänzt
    (beide Dateien). **Browserverifiziert** (Port 3344): Banner erscheint auf `datenschutz.html`,
    Klick auf „Verstanden ✓" setzt `oyi_cookie_consent=necessary`, Banner bleibt auf `impressum.html`
    danach korrekt weg, keine Konsolenfehler.
    **Paddle-Live-Token — kein Bug, sondern Fehlalarm:** vor dem Ändern geprüft, ob Paddle in Local
    wirklich tot ist (wie zuerst angenommen) — ist es nicht. `js/user-plan.js` `openCheckout()` ist
    Locals tatsächlicher, aktiver Trial→Pro-Zahlungsweg (bewusst getrennt von Webs Whop, s.
    Ausnahmeliste oben). Löschen hätte echte Bezahlfunktion zerstört.
    **Dabei aber einen echten, launch-relevanten Bug gefunden:** das Trial-Lock-Modal (wichtigster
    Conversion-Punkt, „Testphase abgelaufen") wird über `js/companies.js` **im Haupt-`app.html`**
    ausgelöst — aber `app.html` lud Paddle nirgends. Der referenzierte Lazy-Loader
    (`js/paddle-init.js`/`PaddleLoader`) existierte nirgends im Code, nur ein Kommentar dazu. Jeder
    Klick auf „Upgrade" im Haupt-App zeigte „Paddle nicht geladen. Bitte Seite neu laden." und tat
    sonst nichts — nur die 3 Unterseiten (`lager`/`eigenbelege`/`rechnungen/index.html`), die Paddle
    eager laden, hatten einen funktionierenden Checkout. **Fix:** `app.html`s CSP um
    `cdn.paddle.com`/`*.paddle.com`/`buy.paddle.com`/`checkout.paddle.com` ergänzt (fehlte komplett)
    und dieselben zwei `<script>`-Tags wie in den 3 Unterseiten ergänzt (kein neuer Lazy-Loader —
    bewusst der einfachste, bereits nachweislich funktionierende Weg). **Browserverifiziert**
    (Port 3344, `app.html`): `Paddle`/`Paddle.Checkout` jetzt definiert, keine CSP-Fehler in der
    Konsole; echten Live-Checkout absichtlich nicht ausgelöst (Live-Token, kein Test-Trigger).
    **Bewusst nicht angefasst:** `successUrl` in `openCheckout()` zeigt auf
    `track-your-income-app.vercel.app` (Webs Produktions-URL) statt auf Local — wirkt wie Copy-
    Paste-Rest, aber ob das Absicht ist (z.B. Lizenzfreischaltung läuft zentral über Web), ist eine
    Architekturfrage, keine mechanische — nicht Teil dieses Auftrags.

**Für den Abschluss dieser Runde offen: nur noch der Rechtstext-Inhalt selbst** (Local beschreibt
weiterhin Supabase+LemonSqueezy statt Trial+Offline-Lizenz — braucht `legal-reviewer`/Anwalt) **und
die Commit-Frage für Local** (48+ geänderte Dateien, HEAD auf `fba3222`, Local-Git eigenständig/
verwaist — User-Entscheidung, bewusst nicht committet in dieser Runde). Alle 21 vorherigen Punkte
sind damit abgeschlossen.

Nach jedem Modul: Web-Code lesen → nach Local portieren → wo möglich Browser-Smoke-Test in Local.
Nach Abschluss eines Punktes hier den Eintrag streichen/abhaken.

---

## offene-punkte-2026-07-15.md

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

1. ✅ **Vorsteuer §14/§33-Beleg-Nachweis** — Option C umgesetzt (Commit `e84e5a0`), User wurde
   per `AskUserQuestion` vorab explizit zwischen A/B/C/Skip gefragt und hat C gewählt: Lieferant/
   Steuernr./Beleg-Foto-Felder in `ausgaben.js`/`buchungen.js`, `Vorsteuer._belegCheck()`
   (§33 UStDV Kleinbetragsrechnung ≤250€ nur Aussteller-Name, darüber zusätzlich Steuernr./
   USt-IdNr.) + Vollständigkeits-Summary in `vorsteuer.js`. Reine Dokumentationshilfe, kein Gate
   auf den Vorsteuerabzug selbst. `node --check` grün, §33-UStDV-Schwelle per Node-Harness
   gegengeprüft (Grenzfälle 250,00€/250,01€, korrekt `<=`).
2. ✅ **Race Condition Rechnungsnummern (parallele Tabs)** — 2026-07-19 umgesetzt (User wollte es
   trotz Zurückstellen-Empfehlung explizit gemacht haben). `Store._withLock()` (neu, `js/
   store.js`) serialisiert die Read-Modify-Write-Sequenz über `navigator.locks.request()`, mit
   synchronem Fallback ohne Cross-Tab-Schutz falls `navigator.locks` fehlt (kein Hard-Fail).
   `nextInvoiceNumber()`, `nextStornoNumber()`, `nextRechInvoiceNumber()` sind jetzt `async`
   (einheitlicher Aufrufer-Vertrag, immer `await`en). Alle Aufrufer umgestellt:
   `rechnung.js` (`buildInvoiceObject()` + beide Aufrufstellen: Preview-Klick, `saveInvoice()`
   mit Doppelklick-Guard auf dem Save-Button), `wiederkehrend.js` (`createInvoiceFromRule()`,
   `processDueRules()` inkl. `forEach`→`for`-Umbau für deterministische Reihenfolge, 3
   Klick-Handler), `dokumente.js` (Storno-Bestätigung mit Doppelklick-Guard). `node --check`
   grün auf allen 5 Dateien. **Nicht mit zwei echten Browser-Tabs verifiziert** (App
   Whop-Login-gated, kein Zugang in dieser Session) — User-Test empfohlen: zwei Tabs "Neue
   Rechnung", kurz hintereinander speichern, Nummern dürfen nicht kollidieren.
3. ✅ **`euer.js`/`bilanz.js`-Dedup** — Annahme im Original-Prompt war zu grob: beide Module
   sind KEINE reine Code-Duplikation, sondern folgen unterschiedlichen, jeweils korrekten
   Rechtsgrundlagen (`euer.js` = EÜR nach §4 Abs.3 EStG, Zufluss-/Abflussprinzip, USt explizit
   als Durchlaufposten separiert; `bilanz.js` = GuV nach §238 HGB, Periodenabgrenzung, direkte
   Netto-Verbuchung ohne Durchlaufposten-Zeile) — die höherwertige Struktur darf NICHT
   vereinheitlicht werden, sonst vermischen sich zwei Steuerregime in gemeinsamem Code. Neue
   `js/steuer-berechnung.js` extrahiert NUR die reine Satz-Arithmetik (`nettoAusBrutto`/
   `nettoSales`/`nettoRetouren`/`nettoRechnungen`/`nettoPurchases`/`nettoExpenses`, nimmt bereits
   gefilterte Datensätze entgegen) als Single Source of Truth für die Brutto→Netto-Formel — genau
   der schmale, sichere Ausschnitt, der als einzig echte Dopplung identifiziert wurde. Beide
   Module umgestellt: `euer.js` verhaltensidentisch (Referenzwerte per Node-Harness vor/nach
   Refactor verglichen, exakt gleich). `bilanz.js`-Umstellung deckte dabei **zwei vorbestehende
   Fehler** auf (durch Vereinheitlichung mit der bereits korrekten `euer.js`-Logik automatisch
   mitgefixt, kein separater Eingriff): 0%-USt-Sätze bei Verkäufen und Betriebsausgaben (z.B.
   steuerfreie EU-Verkäufe, Versicherung) wurden über `parseFloat(x) || 19` fälschlich auf 19%
   gemappt (`0` ist falsy) — Umsatzerlöse/Betriebsausgaben waren bei 0%-Positionen zu niedrig
   genettet, Bilanz-Gewinn dadurch leicht verzerrt. Referenz-Testdatensatz (Node-Harness,
   gemischte 19/7/0%-Sätze) vor/nach Refactor verglichen: `euer.js`-Werte unverändert, `bilanz.js`
   Betriebsergebnis von -155,26€ auf -147,28€ korrigiert (Testdaten, kein Produktivwert).
   Zusätzlich zwei **separate** Befunde beim Lesen entdeckt und NICHT hier mitgefixt (eigener
   Scope, als Background-Tasks geflaggt statt in den Dedup-Commit gemischt): (a) `euer.js` nettet
   Vorsteuer aus „sonstigen Ausgaben" pauschal mit 19%, auch bei `ustSatz=0`-Ausgaben; (b)
   `euer.js` schließt Einkäufe mit storniertem verknüpftem Verkauf komplett aus dem Wareneinkauf
   aus, `bilanz.js` tut das nicht — fachlich klärungsbedürftig, keine offensichtliche Korrektur-
   richtung.

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
| P1-2 | Landing-Copy + technisches SEO-Minimum | 🟡 teils erledigt — Rest s. u. |
| P1-3 | Launch-Baseline messen (Wachstumsplan Juli Woche 1) | ⬜ offen |

**P1-1 Details (`session-prompt-stb-luecken.md`):**
- Lücke 1 (kritisch): Steuerberater ohne eigenes Abo muss durchs Login-Gate kommen können.
- Lücke 2 (klein): "Zugriff entziehen"-Button beim Mandanten fehlt (nur per DevTools möglich).

**P1-2 Details (`session-prompt-landing-seo.md`, 2026-07-19):**
- ✅ `landing-v2.html` war Duplicate-Content-Risiko (canonical/og:url zeigten auf Root-URL,
  Seite selbst live unter `/landing-v2.html` erreichbar, robots.txt blockte sie nicht) —
  User-Entscheid: bleibt liegen, aber `noindex, nofollow` + eigener canonical gesetzt,
  zusätzlich `robots.txt` Disallow ergänzt.
- ✅ `deploy/` (index.html + onepager.html, alter Broschüre-Build-Output) war ebenfalls live
  crawlbar ohne canonical — User-Entscheid: kompletter Ordner entfernt (Altlast).
- ✅ Geprüft, kein Fix nötig: JSON-LD (`SoftwareApplication` + `FAQPage`) existiert bereits
  auf `index.html` und kollidiert nicht mit der CSP (ld+json ist kein von `script-src`
  geblockter Typ). Preis-/Trial-Copy (15 €/Monat, 135 €/Jahr, 7-Tage-Trial mit Kartenpflicht)
  deckt sich exakt mit `agb.html §4`. Steuerberater-FAQ hat korrekten Disclaimer. Kein
  CH/AT-Restwortlaut mehr auf `index.html` (W2-Sweep hat gehalten). Nur eine H1.
- 🔴 Offen: `og-image.png` wird in `index.html` (Zeile 16) referenziert, existiert aber
  nirgendwo im Repo — OG-Bild ist aktuell tot (404). Braucht echtes Asset (1200×630),
  keine Design-Entscheidung die diese Session treffen sollte.
- ⬜ Offen (nicht angefasst, braucht eigene Zeit): Lighthouse-SEO-Score messen,
  Mobile-Lesbarkeit FAQ/Pricing @375px, `verfahrensdokumentation.html` bewusst nicht in
  Sitemap/robots (Orphan-Page, evtl. gewollt).
- ⚠️ Parallel-Session war während dieser Session im selben Ordner aktiv (app.html,
  index.html, css/landing.css, js/whop-auth.js, eigenbelege/js/app.js verändert) —
  nicht angefasst, nicht gestaged.

---

## 🔵 P2 — kann nach Launch

| # | Punkt | Status |
|---|---|---|
| P2-1 | Local 1.7 spiegeln + verwaistes Git reparieren | 🟡 teilweise (2026-07-17): Git repariert (fsck sauber, war nur 3 Commits hinter `origin/main`, nicht wirklich verwaist), 70 uncommittete Änderungen in 4 thematische Commits aufgeteilt + gepusht (`e800115`..`fba3222`). Dabei 2 echte Bugs gefixt: `impressum.html`/`datenschutz.html` waren gelöscht aber noch von `app.html` verlinkt (rechtlich pflichtig, wiederhergestellt aus altem HEAD); `lager/index.html` + `rechnungen/index.html` luden noch 4 gelöschte Cloud-Sync/Auth-Dateien (tote `<script>`-Tags + veraltete Supabase-CSP-Regel entfernt). Schritt 3 (eigentlicher Spiegel-Abgleich Web→Local laut Prompt: USt-Regelbesteuerung, GoBD Edit/Delete, Whop-Grace-Token, Datum-Handling) noch **offen** — dafür braucht es eine eigene Session. CH/AT (`js/schweiz.js`/`js/oesterreich.js`) bestätigt weiterhin aktiv in Local. |
| P2-2 | Performance + Accessibility Audit (Landing/Onboarding) | 🟡 teilweise (2026-07-19): 2 Fixes gebaut+verifiziert: (1) ApexCharts (~600KB) lief bisher als statischer `<script>`-Tag in `app.html` bei JEDEM App-Boot, obwohl `dashboard.js` es eigentlich lazy nachladen sollte — Widerspruch war real, nicht nur Landing. `eigenbelege/js/app.js` bekam eigenen `_ensureApexCharts()`-Lazy-Loader (gleiches Muster wie `dashboard.js`), statischer Tag entfernt. (2) Skip-Link fehlte auf Landing (`index.html`) — ergänzt (`.skip-link` in `css/landing.css`, Ziel `#main-content` auf Hero). Beides statisch verifiziert (Datei-Inhalt via lokalem Server geprüft, keine Konsolenfehler beim App-Boot); `:focus`-Sichtbarkeit des Skip-Links selbst nicht per Screenshot beweisbar, da Browser-Pane-Tab kein OS-Fokus hat (`document.hasFocus()===false`) — Mechanik ist Standard-CSS, User sollte per echtem Tab-Druck gegenchecken. Farbcodierte Status-Badges (bezahlt/offen) bereits WCAG-konform (Text+Icon, nicht nur Farbe) — kein Fix nötig. Noch offen: Lighthouse-Baseline (Performance-Score/LCP/CLS/INP) braucht echtes DevTools, nicht via MCP-Tools messbar; Bundle-Splitting-Frage (`js/app.js`/`js/store.js`, je >130KB) nur als Empfehlung dokumentiert, nicht umgesetzt (Architekturentscheidung, siehe Prompt); Screenreader-Formulare + Touch-Targets in App noch nicht geprüft. |

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
- **Whop-DPA/AV-Vertrag** — Recherche + Anfrage-Entwurf fertig in `plan/whop-dpa-anfrage.md`
  (2026-07-24): kein AVV einschlägig, sondern Bestätigungsanfrage zu Verantwortlichkeits-Status
  + Transfermechanismus. ⬜ Versand an support@whop.com macht User noch.
- **Upstash/Vercel-AVV** — datenschutz.html Ziffer 7 behauptet "wird geschlossen"; beide bieten
  Standard-DPA (Upstash: upstash.com/trust/dpa.pdf, Vercel: vercel.com/legal/dpa, GDPR+SCC+DPF-
  zertifiziert), unklar ist nur ob im jeweiligen Account/Plan aktiv bestätigt/anwendbar
  (Vercel-DPA laut PDF ggf. planabhängig Pro/Enterprise). ⬜ User prüft im eigenen
  Vercel-/Upstash-Dashboard, ob DPA für den genutzten Plan gilt/akzeptiert ist.

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

---

## spec-offline-grace-stb-readonly.md

# Spec: Offline-Grace-Modus + Steuerberater-Read-Only-Zugriff

Status: **Geplant, Umsetzung in neuer Session.** Erstellt 2026-07-09, aus Rückfrage-Runde mit User.

---

## 1. Offline-Grace-Modus (ICE-Fahrt-Szenario)

**Kontext:** Nutzer arbeitet primär am Handy, fährt öfter ICE mit wiederholten, kurzen Netzunterbrechungen (kein einzelner langer Offline-Block). Whop-Auth braucht aktuell Serverkontakt.

**Entscheidung:**
- **Grace-Period: 4 Stunden.** Einmal online eingeloggt → Whop-Token/Access-Flag lokal cachen (localStorage), gültig 4h ohne erneuten Server-Check. Netzflackern während der Fahrt betrifft die App nicht.
- Nach 4h ohne Reconnect: **offen** — harter Re-Login-Zwang oder degradierter Read-Only-Modus? → nächste Session entscheiden.
- Datenhaltung: bereits lokal-first (localStorage/IndexedDB), keine Änderung nötig.
- Reconnect-Sync: Cloud-Sync (Pro, E2E, opt-in) pusht offene lokale Änderungen sobald wieder online.

**Wichtig — Konfliktfall (vom User bestätigt, kein Nice-to-have):**
- Parallele Nutzung auf 2. Gerät (Laptop/PC) während Handy offline ist **real möglich** ("Ja, faktisch zeitgleich möglich").
- Also **kein** einfaches "last write wins". Braucht echte Konflikterkennung beim Reconnect — z. B. Zeitstempel-Vergleich pro Datensatz (Store-Stamping existiert laut [[cloud-sync-backend]] teilweise schon), bei Kollision Warnung/Merge-Dialog statt stillem Überschreiben.
- Zu prüfen: was tut `js/cloud-sync.js` heute bei Konflikt? (Aktueller Stand unverifiziert, nicht annehmen.)

**Offene Punkte für nächste Session:**
1. Wo genau greift der Whop-Check heute (nur App-Start? jeder Page-Load? jede Aktion?) → `js/whop-auth.js` lesen.
2. Wie wird der 4h-Grace-Token gespeichert/geprüft (Ablauf-Timestamp, sauberes Verfallen)?
3. UX bei abgelaufener Grace-Periode + weiterhin offline: klare Meldung statt Absturz/Blockade.
4. Bestehende Konfliktlogik in `js/cloud-sync.js` sichten, ggf. Merge-Strategie nachrüsten.

---

## 2. Steuerberater Read-Only-Zugriff

**Entscheidung (vorläufig, User klärt mit Kunde ab):**
- Tendenz: **eigener Whop-Account für StB**, aber mit Read-Only-Rolle (kein Zeit-Link, kein Extra-Login-System).
- Umfang: **voller Datenbestand** sichtbar (nicht nur EÜR/USt/Belege).
- StB darf nichts bearbeiten — alle Schreib-Aktionen/Buttons müssen für diese Rolle ausgeblendet/deaktiviert sein.

**Wichtiger Architektur-Konflikt (vor Umsetzung unbedingt klären):**
- Cloud-Sync ist laut [[cloud-sync-backend]] E2E, Backup nutzt PBKDF2-User-Key (`js/backup-crypto.js`). Falls Cloud-Sync-Daten client-seitig mit dem Passwort/Schlüssel des Haupt-Nutzers verschlüsselt sind, kann ein zweiter Whop-Account (StB) sie **nicht lesen**, ohne diesen Schlüssel zu kennen.
- Klären: ist `js/cloud-sync.js` echtes E2E mit Nutzer-Key, oder nur Transport-verschlüsselt (TLS) mit Server-seitigem Klartext-Zugriff? Entscheidet, ob ein zweiter Account technisch überhaupt lesen kann oder ob ein Schlüssel-Sharing-Mechanismus (StB bekommt Envelope-Key bei Einladung) gebaut werden muss.
- Falls echtes E2E: braucht Einladungsfluss, der den Schlüssel sicher an den StB-Account weitergibt — eigene Sicherheitsüberlegung, nicht trivial.

**Weitere offene Punkte:**
- Wie wird StB-Account mit genau einem Mandanten-Datenbestand verknüpft? (Einladung per E-Mail? Whop-seitig oder App-seitig verwaltet?)
- Rollenmodell: wo steht "read-only" — Whop-Membership-Metadaten oder App-eigene Rolle?
- Multi-Mandant: falls ein StB mehrere Stackr-Kunden betreut, braucht er später ggf. einen Account-Switcher — aktuell nicht im Scope, aber früh mitdenken.
- **Voraussetzung vor Umsetzungsstart:** User klärt mit dem tatsächlichen Kunden die genaue Zugriffsform ab.

---

## Priorität

Nur Planung diese Session, **keine Code-Änderung**. Umsetzung in neuer Session, sobald:
- (1) offen ist, ob `js/cloud-sync.js` echtes E2E oder Server-lesbar ist (kurzer Code-Check, kein Rätselraten), und
- (2) User Rücksprache mit Kunde zur StB-Zugriffsform abgeschlossen hat.

---

## UMSETZUNG 2026-07-09 (Session „offline-grace")

### Vorfrage 1 — GEKLÄRT: Cloud-Sync ist **echtes E2E**
`js/cloud-sync.js`: 256-bit-Schlüssel via `crypto.getRandomValues` (Z. 399), **nur lokal** in
localStorage, **nie** hochgeladen; AES-GCM client-seitig, Server (Upstash EU) sieht nur Chiffrat.
Schlüssel ist **unabhängig von der Whop-Identität** — Geräte-Sharing nur über den Base32-
Wiederherstellungscode. **Folge für Feature 2:** ein zweiter Whop-Account bekommt aus Cloud-Sync
technisch **nichts**; ohne Schlüssel keine Entschlüsselung. Read-only-StB ist **nicht trivial** (s. u.).

### Feature 1 — GEBAUT + im Browser verifiziert ✅
- **Offline-Grace 4 h** in `js/whop-auth.js`: `whop_grace_until` (ms-Epoch), gestempelt bei jeder
  erfolgreichen Autorisierung (Owner-Bypass + hasAccess). `boot()` short-circuit: frische Grace →
  `_onAuthorized(cachedUser)` **ohne** Server-Roundtrip (ICE-Flacker-Szenario).
- **Netzfehler ≠ Logout:** `_validateAndContinue` unterscheidet jetzt **401/403** (echter Auth-Fehler
  → Token+Grace löschen) von **Netz-/5xx-Fehler** (→ `_graceFallback`, Token bleibt). Vorher wurde
  bei jedem `catch` der Token genuked → offline = rausgeworfen. Behoben.
- **Nach Ablauf (Entscheidung + Begründung):** harter Re-Login (kein degradierter Read-Only-Modus).
  Grund: local-first → keine Datenverluste; ein zweiter Offline-Modus wäre Extra-Code/State ohne
  Mehrwert (YAGNI). Klare, offline-spezifische Meldung statt Absturz/Blockade.
- **Konflikt-Erkennung in `js/cloud-sync.js`:** vorher per-Record-LWW ohne Warnung. Neu: pro Scope
  `oyi_sync_base_<scope>` (updatedAt je Record beim letzten Sync). Bei Merge → echte Kollision nur,
  wenn **beide** Seiten seit Base bewegt (kein Falsch-Positiv bei sequentiellen Syncs). LWW bleibt
  (neuere Version gewinnt, nie Datenverlust der neuesten Fassung), **aber** Warn-Toast + Konsolen-Log
  mit Anzahl → Nutzer weiß Bescheid.
  - **Bewusster Tradeoff:** Warnung statt blockierendem Merge-/Keep-Both-Dialog (mobile/ICE-tauglich).
    Falls „beide Fassungen behalten + manuell mergen" gewünscht → Folge-Session.
- Test: `node test-cloud-sync.js` → 5/5 (inkl. neuer Konflikt-Test). Browser: Grace-Boot ohne
  Roundtrip, 401-Cleanup, beide Module fehlerfrei geladen — verifiziert.

### Feature 2 — IN ARBEIT: Envelope-Key gewählt (User-Go 2026-07-09)
User-Entscheidung: **Option 2 (Envelope-Key, sauber)** — echter Entzug/Revocation gefordert,
nicht die UI-only-Krücke. Backend-Realität (aus `api/sync.js`): Daten liegen unter
`sync:<ownerId>:<scope>`, StB hat andere userId → kann ohne Grant **nicht mal pullen**. Read-only
ist daher server-seitig erzwingbar (StB-Token schreibt nie in fremde Owner-Keys) — die UI-Sperre
ist nur noch UX, keine Sicherheitsgrenze.

**Phasen:**
- **Phase 1 — GEBAUT + node-getestet ✅** (`js/stb-share.js`, `test-stb-share.js`, 3/3):
  ECDH-P-256-Envelope. `genKeyPair` / `wrapKey(dataKey, granteePub)` / `unwrapKey(env, granteePriv)`.
  Ephemerales ECDH je Envelope (forward secrecy); fremder Key kann kryptografisch nicht entpacken.
- **Phase 2 — Server (`api/sync.js`) GEBAUT + handler-getestet ✅** (`test-api-sync.js`, 9/9,
  gemocktes Upstash+Whop). Neue Actions (userId immer server-seitig aus Token):
  - `register_pubkey {pub}` → `pubkey:<userId>` (idempotent; **kein Pro nötig** — Grantee-Read).
  - `get_pubkey {granteeId}` → pub-JWK des StB (Owner, Pro).
  - `grant {granteeId, envelope}` → `grant:<ownerId>:<granteeId>` = {role:'readonly', envelope,
    ownerName, createdAt}; `SADD grantsfor:<granteeId> <ownerId>` (Owner, Pro).
  - `list_grants` → für den auth. StB alle {ownerId, ownerName, envelope} (kein Pro).
  - `revoke {granteeId}` → Grant löschen + SREM (echter Entzug; Owner sollte danach re-keyen).
  - `pull {scope, owner}` → mit `owner`: nur bei `grant:<owner>:<authUserId>` (kein Pro, Grant
    autorisiert). `push`/`delete` mit `owner` → **immer 403 readonly** (vor dem Pro-Gate).
  - **Zero-Cost bestätigt:** kein Zweit-Abo für den StB (Grant autorisiert), nur winzige Redis-Keys,
    keine neue Function/Fremdleistung. Eigener Scope ohne Pro bleibt `pro_required` (Gate intakt).
- **Phase 3 — UI GEBAUT (Live-App read-only, User-Wahl) — Browser-E2E ausstehend.**
  - `js/stb-share.js` (erweitert): Client-Flows — eigenes ECDH-Keypair lokal (`oyi_stb_privkey/pubkey`),
    `registerPubkey()` beim Login, `showCode()` (Freigabe-Code = Whop-userId), `inviteFlow/_doInvite`
    (Owner: get_pubkey→wrapKey(CloudSync.keyBytes)→grant), `clientsFlow/enterClient/exitClient`,
    `isReadonly()`/`blocks()`, `initReadonlyBanner()`.
  - `js/cloud-sync.js`: `keyBytes()`, `foreignLoad(ownerId, kb)` (Mandanten-Firmen pullen+entschlüsseln,
    lokal als `_readonly`-Client-Firmen ablegen), `foreignUnload()`. Sync überspringt `_readonly`-Firmen,
    `onLocalChange` gesperrt im Read-Only → Mandantendaten werden NIE hochgeladen.
  - `js/actions.js`: zentraler Read-Only-Guard am Dispatch (blockt Schreib-Verben via Regex; nur
    click/submit) — EIN Chokepoint statt 155 Buttons.
  - `css/style.css`: `.stb-readonly`-Regeln blenden Schreib-Buttons per Attribut-Suffix aus
    (extern statt inline, da CSP injizierte `<style>` blockt) — deckt so auch die eb-*/rech-*-
    Router-Buttons ab. Banner-Platz via `padding-top`.
  - `js/whop-auth.js`: Menü-Einträge (einladen / Mandanten / Mein Code) + registerPubkey + Banner-Init.
  - `app.html` **+ rechnungen/lager/eigenbelege/index.html**: laden `js/stb-share.js`.
  - **Architektur:** Mandanten erscheinen als zusätzliche READ-ONLY-Firmen in der bestehenden
    Multi-Company-Registry → volle App zeigt sie via CompanyManager, kein separater Renderpfad.
  - **co_id-Kollisionsschutz:** `foreignLoad` lässt Mandanten-Firmen mit ID-Kollision zu einer
    eigenen Firma aus (nie überschreiben) + Warn-Toast.
  - **Standalone-Seiten:** stb-share.js dort geladen → Banner + CSS-Ausblendung greifen. UI-Dispatch-
    Guard deckt nur js/actions.js-Aktionen; eb-*/rech-* haben eigene Router → dort schützen CSS-
    Ausblendung + Server-Hard-Block (StB kann nie in fremde Owner-Keys schreiben).
  - **NOCH OFFEN (nur das):** Browser-E2E mit 2 echten Whop-Accounts (Einladung→Grant→Live-
    Mandantenansicht→Entzug) — Whop-Gate, nicht automatisierbar, muss der User mit 2 Accounts fahren.

**Rest-Risiko/Hinweis:** StB hat lesenden Vollzugriff (gewollt). „Read-only" schützt Owner-Daten vor
Schreibzugriff (server-seitig), nicht vor Lesen/Export durch den StB — das ist der Zweck.

### (Historischer Architektur-Vergleich, vor Go)
Wegen echtem E2E gibt es **keinen** server-seitigen Read-only-Schalter (Server kann Klartext nicht
sehen). Optionen, schlankster zuerst:
1. **Schlüssel-Weitergabe + UI-Read-only (pragmatisch, empfohlen als MVP):** Haupt-Nutzer lädt StB per
   bestehendem „Mit bestehendem Sync verbinden"-Flow ein (Wiederherstellungscode). StB-Whop-Account
   bekommt App-eigene Rolle `readonly` (localStorage-Flag, gesetzt bei Einladung/Whop-Metadaten) →
   alle Schreib-Buttons/-Aktionen ausgeblendet. **Schwäche:** UI-Read-only ist client-seitig
   umgehbar; StB hat kryptografisch Vollzugriff; keine Schlüssel-Rotation/Entzug ohne Re-Key.
2. **Envelope-Key (sauber, teuer):** Datenschlüssel wird für den StB-Account mit dessen Public-Key
   verpackt (Einladung erzeugt Envelope). Entzug = Envelope löschen + Re-Key. Deutlich mehr Krypto-/
   Server-Arbeit; nur wenn echter Entzug/Revocation gefordert.
3. **Read-only nur crypto-erzwingbar wäre:** separater „View"-Schlüssel für einen unverschlüsselt-
   signierten Export-Snapshot — eigenes Teilprojekt, aktuell Overkill.
Offen bleibt (User↔Kunde): genaue Zugriffsform, Rollen-Ablage (Whop-Membership-Metadaten vs. App),
Multi-Mandant-Switcher (bewusst out-of-scope).

---

## todo-rest-2026-07-24.md

# Stackr Web 1.7 — Rest-TODO (Stand 2026-07-24)

Löst `plan/todo-rest-2026-07-21.md` ab. Dient als Einstiegspunkt: jeder größere Punkt verlinkt auf
seine eigene `session-prompt-*.md`-Datei (Copy-Paste-Prompt für eine neue Session), kleine Punkte
stehen direkt hier. Vor dem Abarbeiten immer `git status`/`git log` frisch prüfen — mehrere Sessions
laufen teils parallel im selben Ordner.

---

## 🔴 Blockiert auf andere (nicht von einer Coding-Session lösbar)

> **Abarbeitbare Checklisten dafür** (jetzt Abschnitte in dieser Datei, nicht mehr eigene Dateien):
> [user-live-checks.md](#user-live-checks-md) (alle Live-Tests, DPA-Dashboards, Lighthouse-Baseline)
> und [whop-checkout-spotcheck.md](#whop-checkout-spotcheck-md) (Checkout gegen AGB §4 /
> refund.html — Teil 1 am 2026-07-27 durchgeführt, Fortsetzung in
> [session-prompt-whop-checkout-nachpruefung.md](#session-prompt-whop-checkout-nachpruefung-md)).

- **Anwalts-Freigabe §11 AGB-Haftung + §356 Abs.5 BGB Trial-Klausel** — beauftragt, Antwort offen.
  `plan/session-prompt-anwalt-briefing.md`.
- **Whop-DPA/AV-Vertrag** — noch nicht angefordert. `plan/session-prompt-whop-dpa-anfrage.md`
  (Versand macht User selbst).
- **Echte Live-Tests mit echtem Whop-Login** (User selbst, App ist login-gated):
  - 2-Tabs-Test Rechnungsnummern-Race-Fix — `plan/session-prompt-ust-bulletproof.md`.
  - Blob-Sync Live-Test — `plan/session-prompt-blob-sync.md`.
  - Kz.41/21-EU-B2B-Test (§13b) — `plan/session-prompt-ust-bulletproof.md` Zeilen 30-39.
  - USt-ID-Diagnose GbR-Regelbesteuerung (Lager-Punkt 10) — `plan/session-prompt-lager-feature-batch.md`.

## 🟢 Lager-Feature-Batch (Kunden-Wunschliste, P1)

`plan/session-prompt-lager-feature-batch.md` — Punkt 6/4/7/1/5 gebaut+verifiziert (2026-07-23,
Commit `8470bde`). Punkt 3 (Farben-Mehrfachauswahl, neu gebaut statt migriert — Ist-Zustand-Annahme
der Plan-Datei war falsch), Punkt 8 (globale Klick-Suche) und Punkt 9 (Lager-Dialog in Rechnungen,
volle Filter+Foto) am 2026-07-24 gebaut+browserverifiziert+gepusht (`b6ba3ab`). Punkt 2 (Status
frei editierbar) am 2026-07-24 gebaut: `Store.getLagerStatusListe()/addLagerStatus()/
renameLagerStatus()/deleteLagerStatus()` (company-scoped, lazy — Defaults erst persistiert bei
erster Mutation), `Lager.STATUS_CONFIG` in `js/lager.js` von hart codiertem Objekt auf dynamischen
Getter umgestellt (alle ~12 Referenzstellen unverändert, lesen weiter `this.STATUS_CONFIG[key]`).
`verfuegbar`/`verkauft` bleiben `system:true`, weder umbenenn- noch löschbar. Umbenennen ändert nur
das Label (Key bleibt stabil → keine Artikel-Migration nötig). Löschen blockiert, solange ein
Artikel den Status trägt (kein Fallback-Label-Aufwand nötig, da keine verwaisten Keys entstehen
können). Neuer "Status"-Button im Lager-Header, Modal analog zum Kategorien-Editor
(`lager/page.js` `openStatusModal()`). Isolierter Logik-Check (Slugify/Kollision/System-Schutz/
In-Use-Schutz/Rename-Key-Stabilität) grün. **Browser-Smoke am 2026-07-25 nachgeholt** (Claude in Chrome, echtes Chrome-Profil des Users,
lokaler `npx serve` auf :3333 — Whop-UI-Klickpfad selbst blieb ungetestet, da der Whop-Gate-Check
gegen den lokalen Server ohne `/api`-Routes fehlschlägt und ein echter Login auf die Produktions-
URL umleiten würde; stattdessen `Store`/`Lager`-Code direkt im echten Browser-Kontext ausgeführt):
Anlegen/Umbenennen/Löschen, System-Key-Schutz (`verfuegbar`/`verkauft`), In-Use-Löschschutz,
verwaister-Key-Badge-Fallback, Status-Modal-Rendering (5 Rename-/5 Delete-Buttons, 2 System-Badges)
— alles grün, Testdaten aufgeräumt. Feature gilt als fertig.
**Offen:** Punkt 10 (USt-ID-Diagnose, Live-Test-blockiert).

## 🟠 Rechnung/Eigenbeleg-Vollaudit — Rest der 29 Funde (P1/P2 gemischt)

`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md` — Funde 1-8 gefixt+gepusht
(Commit `2fbfd19`). **Funde 9-29 komplett abgearbeitet+gepusht** (`0ef02c2`, Nachzügler-Fix
`7b86c68`) — Teilzahlung/Ratenzahlung, A11y (Modals/Labels/Touch-Targets/Kontrast),
Rechnungs-Workflow-Bugs (Versand-Status, Mahnung-Lager-Sync, Fälligkeitsdatum), Angebot→Rechnung,
komplette Niedrig-Prio-Sammelliste. Die thematischen Einzeldateien (`session-prompt-teilzahlung-
ratenzahlung.md`, `-vollaudit-a11y-rest.md`, `-vollaudit-rechnungsworkflow-bugs.md`,
`-vollaudit-angebot-zu-rechnung.md`, `-vollaudit-niedrig-sammelliste.md`) sind damit erledigt,
keine weitere Aktion nötig. Modul gilt als vollständig auditiert.

## 🟠 GoBD-Audit Eigenbeleg-Modul (P1, überschneidet mit Vollaudit Fund 4)

`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md` — **komplett abgearbeitet+gepusht**
(`9ee009e`, 2026-07-24): Fund 1+2 (Audit-Log + Storno-Pattern + Zähler-Reset-Fix), Fund 3+6
(Vorsteuerabzug auf §33-UStDV-Ausnahmefall beschränkt, inkl. Formular-Checkbox), Fund 4+5+7
(Skonto-Hinweis, Geschäftsführer-Mehrfach-Hinweis, E-Rechnung-Notiz). Die drei Einzeldateien
(`session-prompt-gobd-eigenbeleg-auditlog.md`, `-eigenbeleg-vorsteuer-begruendung.md`,
`-rechnung-kleine-rechtstext-ergaenzungen.md`) sind erledigt.

## 🟡 Launch-nah (P1)

- **SEO-Rest** (`plan/session-prompt-landing-seo.md`): nur noch **Lighthouse-Baseline** offen
  (DevTools nötig). Touch-Targets waren bei Prüfung am 2026-07-26 bereits erledigt
  (`css/style.css`: `min-height:44px` auf `.btn`/`.btn-small`/`.btn-sm`, WCAG 2.5.5, mit
  Kommentaren belegt). Screenreader-Formulare am 2026-07-26 gefixt (Commit `505a190`): die App
  rendert durchgehend `<label class="form-label">…</label><input id="x">` **ohne** `for=` —
  rund 1000 Stellen, d.h. Screenreader lasen die Felder unbenannt vor. Statt jede Render-Stelle
  anzufassen zieht `Utils.linkOrphanLabels()` die Verknüpfung zur Laufzeit nach,
  `Utils.startLabelObserver()` (MutationObserver, selbststartend) hält sie für dynamisch
  gerenderte Views aktuell. Übersprungen: umschließende Labels, Felder mit `aria-label`,
  bereits verknüpfte Felder. Im Browser gegen 7 Fälle geprüft.
- **Launch-Baseline messen** — noch nicht begonnen, kein eigenes File nötig (einmalige Messung,
  siehe `plan/2026-07-juli.md` Wachstumsplan).
- **UI-Politur** — eigene interaktive Session mit User: `plan/session-prompt-ui-politur.md`.
- Weitere Test-Kunden akquirieren — macht User selbst.

## 🔵 Nach Launch (P2)

- **Local 1.7 Code-Sync (P2, groß)** — vollständiger Drift-Audit am 2026-07-25 gefahren, siehe
  `plan/local-sync-backlog-2026-07-25.md` (29 Einzelpunkte, praktisch jede geteilte Datei
  betroffen — u.a. §25a Differenzbesteuerung fehlt komplett, Ist-UVA-Unterdeklaration,
  GbR-Betriebsausgaben immer 0). Fortsetzungs-Prompt: `plan/session-prompt-local-sync-
  fortsetzung.md` — **Punkt 1/22 (`js/store.js`) bereits fertig+browserverifiziert**, weiter mit
  Punkt 2 (`js/steuer-berechnung.js`). **Stand 2026-07-26: Punkte 1-5, 7 und 12 fertig** (store,
  steuer-berechnung, bilanz, euer, ustvoranmeldung, oss, rechtsform — alle browserverifiziert);
  weiter mit Punkt 6 (`gbr-modul.js`/`gbr.js`, Achtung Gegen-Drift bei der Input-Härtung).
  Löst `session-prompt-local-spiegeln.md` inhaltlich ab
  (dessen Abschnitt 3 ist jetzt nur noch ein Verweis hierher, Abschnitte 1-2 zur Local-Git-Hygiene
  bleiben separat offen).
- ~~**Local→Web Datentransfer (neues Feature)**~~ — **erledigt 2026-07-25**: Firmen-Checkbox-Auswahl
  im Local-Dialog „Zu Web wechseln" (`_buildBundle(onlyLand, companyIds)`) + eigene Web-Sektion
  „Daten aus Local 1.7 importieren" mit eigenem Dialog (nutzt unverändert `doImport()`).
  `js/backup-crypto.js` in Web+Local gespiegelt (byte-identisch). Browserverifiziert: Export nur
  angehakter Firmen, CH bleibt draußen, 0 Firmen → Button disabled, Web-Import mergt korrekt inkl.
  Audit-Re-Chaining (`verifyAuditChain` valid). Session-Prompt-Datei entfernt.
- **Performance-Rest** (`plan/session-prompt-performance-a11y.md`): Lighthouse-Baseline,
  Bundle-Splitting `js/app.js`/`js/store.js` (je >130KB).
- **Whop-Auth-Vollaudit** (`plan/session-prompt-whop-audit.md`): am 2026-07-24 durchgegangen —
  Rate-Limit (`api/whop-token.js`/`api/whop-access.js`), Pagination-Limit (`MAX_PAGES=200`,
  nicht mehr 20), Owner-Bypass-Sync, Fokus-Recheck-Guard waren bereits gehärtet/gefixt (nicht in
  dieser Datei nachgetragen). **1 echte Lücke gefunden+gefixt:** `js/cloud-sync.js` fehlte auf
  den 3 Standalone-Seiten (`lager/index.html`, `rechnungen/index.html`, `eigenbelege/index.html`)
  komplett — nur `app.html` lud es. Änderungen, die ein Nutzer ausschließlich auf einer dieser
  Seiten macht (ohne `app.html` in derselben Session zu öffnen), synchten nie in die Cloud. Fix:
  Script-Tag ergänzt, kein weiterer Code nötig (`CloudSync.init()` läuft bereits guarded in
  `js/whop-auth.js` `_onAuthorized`). Kein weiterer Aufwand offen, Datei kann bei Bedarf archiviert
  werden.
- `api/whop-token.js`/`api/whop-access.js` Redis-Fallback: bei Prüfung bereits mit sichtbarem
  `console.warn` statt Silent-Skip umgesetzt — kein Fix nötig.
- **USt-Bulletproof Restpunkte** (`plan/session-prompt-ust-bulletproof.md`): Punkt 1
  (§14-Pflichtangaben-Check) war bei Prüfung am 2026-07-26 **bereits als Option C umgesetzt**
  (Commit `e84e5a0`, User hatte C gewählt — Lieferant/Steuernr./Beleg-Foto in `ausgaben.js`/
  `buchungen.js` + `Vorsteuer._belegCheck()`/`_belegSummary()` mit §33-UStDV-250€-Grenze); diese
  Todo-Datei war an der Stelle veraltet. Verbliebene echte Lücke gefunden+gefixt (`70c292d`):
  die Lieferant-Felder gab es nur im *Bearbeiten*-Dialog, nicht beim *Anlegen* einer
  Einkaufs-Session — neu angelegte Einkäufe fielen im Belegvollständigkeits-Check daher immer
  durch. Jetzt zwei Session-Felder in `buchungen.js` (gelten für alle Artikel der Session, im
  `_sessionMeta` persistiert) + `_belegCheck()` akzeptiert zusätzlich das Lager-Feld `haendler`
  als Aussteller-Namen. Punkt 2
  (Rechnungsnummern-Race) war bei Prüfung am 2026-07-24 **bereits umgesetzt** (`Store._withLock()`
  mit `navigator.locks`, Feature-Detect-Fallback, Duplikat-Schutz in `nextRechInvoiceNumber()`) —
  nur in dieser Todo-Datei nicht als erledigt markiert, kein weiterer Aufwand nötig.

## Bewusst akzeptierte Lücken (nicht anfassen ohne expliziten Wunsch)

- Superseded Blob-Anhänge werden nicht per Referenzzählung aufgeräumt.
- `js/companies.js` `migrateEigenbelegeToCompanies()` schreibt weiter direkt in localStorage
  (nur Alt-Install-Fall, selbstheilend).
- StB-Re-Key beim Zugriffsentzug (Alt-Snapshots bleiben mit altem Schlüssel entschlüsselbar).
- Vercel-Blob-Attachments `access:'public'` (durch Verschlüsselung + Random-Suffix entschärft).
- Whop-Gate ist für App-Kernfunktionen rein clientseitig (bewusste Local-First-Folge).
- `ui-lab.html` lädt Tabler-Icons ohne SRI (Prototyp, kein Kundendatenzugriff).
- `node_modules/` fehlt in `.gitignore`.

---

**Erledigt seit 2026-07-23**: Vollaudit-Funde 1-8 gefixt+gepusht (`2fbfd19`) — Company-Scoping-Leck
`wiederkehrend.js`, Monatsend-Rollover-Bug, Verzugszinsen §288 BGB, GoBD-Sperre bei
`alleLoeschen()`, XSS-Fix `zahlungswegSonstig`, Cookie-Banner `eigenbelege/index.html`. Steuer-Audit
(§25a/KSA/Kassenbuch/GWG/canEdit/EÜR-Z64) komplett gefixt+gepusht (`51cfc28`/`f7a56dd`). EÜR/UVA-
Sub-Tab-Merge + 2 Nachzügler-Bugfixes (`2fbfd19`.../`6eba3ff`). Lager: Storno-Freigabe gesperrter
Belege, Artikelnr-Feld, Kategorien/Zielgruppe/Händler (`8470bde`).

**Erledigt 2026-07-24** (mehrere parallele Sessions, im Rahmen einer Gesamtabarbeitungs-Session
zusammengeführt/geprüft/committet): Vollaudit-Rest Fund 9-29 komplett (`0ef02c2`/`7b86c68`),
GoBD-Eigenbeleg-Audit-Log+Storno+Vorsteuer-Einschränkung+Rechtstexte komplett (`9ee009e`),
Lager-Feature-Batch Farben/Lager-Dialog-Filter/globale Klick-Suche (`b6ba3ab`). Damit sind alle
P1/P2-Punkte aus diesem TODO abgearbeitet außer: Lager Punkt 2 (Status frei editierbar, eigene
Session empfohlen) und die eingangs unter „Blockiert"/„Launch-nah"/„Nach Launch" gelisteten Punkte.

Für ältere erledigte Punkte: `plan/todo-rest-2026-07-21.md` (Fußnote dort verweist weiter zurück).

---

## user-live-checks.md

# Live-Checks, die nur der User machen kann

Stand: 2026-07-26. Sammelt alle offenen Punkte, die eine Coding-Session **nicht** erledigen kann —
weil sie echten Whop-Login, ein fremdes Dashboard oder DevTools brauchen. Jeder Punkt ist so
geschrieben, dass er ohne Rückfrage abarbeitbar ist.

Der Whop-Checkout-Spotcheck hat eine eigene Datei: `plan/whop-checkout-spotcheck.md`.

**Warum ich das nicht selbst mache:** Die App ist Whop-login-gated. Laut Absprache
(Memory `whop-gate-browser-testing`) logge ich mich nie selbst ein und es soll auch keinen
Dev-Bypass im Code geben. Ein lokaler Server hat keine `/api`-Routes, ein echter Login würde auf die
Produktions-URL umleiten.

---

## 1. Rechnungsnummern-Race mit zwei Tabs 🔴

**Warum:** `Store._withLock()` serialisiert die Nummernvergabe über `navigator.locks`. Der Code ist
gebaut und syntaktisch geprüft, aber **nie mit zwei echten Tabs getestet**. Doppelt vergebene
Rechnungsnummern wären ein §14 Abs. 4 Nr. 4 UStG-Verstoß.

**Ablauf:**
1. App in **zwei Browser-Tabs** öffnen, in beiden zu „Neue Rechnung".
2. In beiden Tabs identische Testdaten eintragen.
3. **Kurz hintereinander** (< 1 Sekunde) in beiden auf Speichern klicken.
4. Rechnungsliste öffnen.

**Erwartet:** zwei Rechnungen mit **aufeinanderfolgenden, verschiedenen** Nummern
(z. B. RE-2026-014 und RE-2026-015).

**Fehlerbild:** beide tragen dieselbe Nummer → sofort melden, dann ist der Lock wirkungslos.

- [ ] geprüft am: __________  Ergebnis: __________

---

## 2. Kz. 41 / Kz. 21 bei EU-B2B (§13b UStG) 🔴

**Warum:** Warenlieferungen (Kz. 41) und sonstige Leistungen (Kz. 21) müssen in der UVA **getrennt**
ausgewiesen werden. Die Logik ist im Browser gegen synthetische Daten verifiziert, aber der
UI-Klickpfad (Dropdown „Art (EU)" pro Position) noch nicht.

**Ablauf:**
1. Kunde anlegen: EU-Land **≠ DE** (z. B. Frankreich), **gültige USt-IdNr.** hinterlegen.
2. Rechnung an diesen Kunden mit **zwei Positionen**: eine Ware, eine Dienstleistung.
3. Im §13b-Hinweisblock erscheint pro Position ein Dropdown **„Art (EU)"**.
4. **Erst ohne Auswahl speichern** → muss mit Toast-Fehler abgelehnt werden (erste Option ist
   `disabled`, es gibt bewusst keinen Default).
5. Beide Positionen zuordnen, speichern → muss durchgehen.
6. „Steuer & EÜR" → Sub-Tab **USt-Voranmeldung**, Zeitraum passend wählen.

**Erwartet:** Kz. 41 zeigt den Netto-Betrag der **Ware**, Kz. 21 den der **Leistung** — nicht beide
unter Kz. 41.

- [ ] geprüft am: __________  Ergebnis: __________

---

## 3. Blob-Sync Roundtrip 🟠

**Warum:** Cloud-Sync mit Vercel Blob + Chunking ist committet und statisch verifiziert, aber nie
mit echten Daten gegen die Live-Infrastruktur gelaufen. Details:
`plan/session-prompt-blob-sync.md`.

**Ablauf:**
1. Mit echtem Pro-Zugang einloggen, Cloud-Sync aktivieren.
2. **Großes Rechnungslogo** hochladen (> 20.000 Zeichen Base64) → syncen → auf einem zweiten Gerät
   bzw. nach `localStorage`-Reset wiederherstellen.
3. **Anhang > 4 MB** erzeugen (großes Eigenbeleg-Foto) → prüfen, dass das Chunking greift und der
   Roundtrip vollständig ist.
4. Denselben Anhang **zweimal** syncen → im Netzwerk-Tab prüfen, dass der zweite Sync **keinen**
   erneuten Upload auslöst (Content-Hash-Cache).
5. **Art.-17-Löschung** auslösen → im Vercel-Blob-Dashboard prüfen, dass die Blobs weg sind.
6. Browser-Konsole: **kein** `connect-src`-CSP-Fehler beim Blob-Request.

- [ ] geprüft am: __________  Ergebnis: __________

---

## 4. USt-ID-Diagnose bei GbR-Regelbesteuerung 🟠

**Warum:** Letzter offener Punkt aus dem Lager-Feature-Batch
(`plan/session-prompt-lager-feature-batch.md`, Punkt 10). Betrifft das eigene GbR-Setup.

**Ablauf:** GbR-Firma auf Regelbesteuerung stellen, USt-IdNr. in den Stammdaten hinterlegen, prüfen
dass sie auf Rechnungen korrekt gezogen wird und die Diagnose keine Falschmeldung wirft.

- [ ] geprüft am: __________  Ergebnis: __________

---

## 5. Upstash- und Vercel-DPA für den genutzten Account-Plan 🟠

**Warum:** Beide Anbieter haben offizielle, DSGVO/SCC/DPF-konforme Standard-DPAs — das ist extern
bestätigt. Offen ist nur, ob euer **konkreter Plan** sie automatisch einschließt; die Vercel-PDF
deutete eine Pro/Enterprise-Bindung an. Ohne gültiges AVV fehlt die Art.-28-Grundlage für die
Auftragsverarbeitung.

**Ablauf:**
1. **Vercel-Dashboard** → Settings → Legal / Privacy: ist das DPA für den aktuellen Plan aktiv?
   Ggf. explizit akzeptieren. Quelle: `vercel.com/legal/dpa`
2. **Upstash-Dashboard** → Account/Legal: dito. Quelle: `upstash.com/trust/dpa.pdf`
3. Beide DPAs als PDF ablegen (Nachweispflicht Art. 5 Abs. 2 DSGVO).

- [ ] Vercel geprüft am: __________  DPA gilt: ja / nein
- [ ] Upstash geprüft am: __________  DPA gilt: ja / nein

---

## 6. Whop-DPA-Anfrage versenden 🟠

Die Anfrage liegt fertig formuliert in `plan/whop-dpa-anfrage.md`. Es geht darum, Whops Einordnung
als **eigenständig Verantwortlicher** (nicht Auftragsverarbeiter) bestätigt zu bekommen — so steht
es aktuell in `datenschutz.html`.

- [ ] versendet am: __________  Antwort am: __________

---

## 7. Lighthouse-Baseline 🟡

**Warum:** Letzter offener Punkt aus `plan/session-prompt-landing-seo.md` und dem Performance-Rest.
Braucht DevTools, die ich nicht habe. Dient als Vorher-Wert für spätere Optimierung.

**Ablauf:**
1. Chrome DevTools → Lighthouse, Modus **Mobile**, alle Kategorien.
2. Auf der **Landing-Page** (`/`) laufen lassen — im privaten Fenster, ohne Extensions.
3. Vier Scores notieren.
4. Auf `/app.html` wiederholen (eingeloggt) — dort ist vor allem Performance interessant, wegen
   `js/app.js` und `js/store.js` (je > 130 KB).

| Seite | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` (Landing) | | | | |
| `/app.html` | | | | |

**Gemessen am:** __________

Danach entscheiden, ob Bundle-Splitting (P2) sich überhaupt lohnt — ohne Baseline ist das Raten.

---

## Nach dem Abarbeiten

Erledigte Punkte hier abhaken und in `plan/todo-rest-2026-07-24.md` unter
„🔴 Blockiert auf andere" streichen. Findet ein Test einen echten Fehler: Fehlerbild notieren und
als eigenen Punkt in die Todo-Datei aufnehmen — nicht direkt hier weiterdokumentieren, diese Datei
ist eine Checkliste, kein Bugtracker.

---

## vollaudit-runde2-2026-07-25.md

# Voller Rechts-/Compliance-Audit — Runde 2

Stand: 2026-07-25. Fortsetzung von Runde 1 (Kern-Rechtstexte + AVV-Klärung, siehe
`plan/whop-dpa-anfrage.md`). Diese Runde: Cross-Page-Konsistenz, GoBD-Doku-Aktualität gegen
den aktuellen WIP-Code, plus fokussierter `/datenschutz`- und `/security-stackr`-Durchlauf auf
der von zwei Explore-Agenten kartierten Datei-Fläche. Reine Diagnose, keine Fixes angewendet.

---

## A. GoBD-Doku-Drift — Cloud-Anker-Feature (uncommitted)

**Befund:** Der WIP-Code (`js/store.js`, `js/cloud-sync.js`, `js/protokoll.js`, `api/sync.js`)
fügt einen neuen **"Cloud-Anker"-Mechanismus** hinzu:

- `Store._auditContentHash()` bildet einen stabilen SHA-256-Inhaltshash je Audit-Log-Eintrag.
- `CloudSync._pushAuditAnchors()` meldet neue Einträge (nur `{id, hash}`, keine Klardaten)
  nach jedem Sync an `api/sync.js` (`action: 'anchor'`), die sie **append-only** in einer
  Redis-Liste ablegt (RPUSH + LTRIM auf 20.000 Einträge, `action: 'anchor_pull'` zum Lesen).
- `Protokoll`-UI (`auditVerifyBtn`) ruft zusätzlich zur lokalen Hash-Ketten-Prüfung
  `CloudSync.verifyAuditAnchors()` auf und meldet Abweichungen als Manipulationsverdacht.
- Ein Code-Kommentar benennt die eigentliche Motivation präzise: die rein lokale Hash-Kette
  kann von einem Angreifer mit Kenntnis der Formel **in sich konsistent neu berechnet**
  werden — der externe, serverseitig einmal geschriebene Anker verhindert genau das
  rückwirkend, weil ein späteres Abweichen zwischen Client-Hash und Server-Anker auffällt.
- Art. 17 DSGVO sauber mitgezogen: `action: 'delete'` löscht jetzt auch `anchorKey`.
- StB-Readonly-Modus (`body.owner`) ist bei beiden neuen Actions korrekt blockiert (403),
  konsistent mit dem bestehenden Steuerberater-Zugriffsmodell.

✅ Technisch sauber umgesetzt — Datensparsamkeit (nur Hash+ID+Timestamp), Art.-17-Löschung,
StB-Readonly-Konsistenz, bestehende Rate-Limits (`api/sync.js` IP- + User-Rate-Limit greifen
auch für `anchor`/`anchor_pull`, da im selben Handler nach denselben Checks) alle korrekt.

❌ **Lücke:** `verfahrensdokumentation.html` Abschnitt 4 ("Nachvollziehbarkeit —
Änderungsprotokoll") beschreibt nur die lokale Hash-Kette, nicht den neuen externen Anker.
Sobald dieser WIP-Code committet/live ist, ist die Verfahrensdoku an dieser Stelle unvollständig
— relevant, weil das Dokument explizit als Nachweis gegenüber Finanzamt/Betriebsprüfung gedacht
ist (GoBD Rz. 64, Unveränderbarkeit).
→ Fix (nicht ausgeführt, nur benannt): Abschnitt 4 um 2-3 Sätze zum Cloud-Anker ergänzen —
dass bei aktivem Cloud-Sync zusätzlich ein externer, vom Client nicht rückwirkend
veränderbarer Hash-Referenzpunkt existiert, der die Aussagekraft der Hash-Kette verstärkt.
**Priorität: BALD** (erst relevant sobald der WIP-Stand committet wird — vorher kein
Doku-Update nötig, sonst dokumentiert man Code der noch nicht live ist).

🟡 **Zu bewerten (nicht kritisch):** `ANCHOR_MAX = 20000` (LTRIM-Deckel) — bei sehr aktiven,
langjährigen Firmen könnten die ältesten Anker nach Jahren aus der Liste fallen, während die
§147-AO-Aufbewahrungsfrist 10 Jahre verlangt. Für die allermeisten Solo-/Kleinunternehmer-Konten
weit ausreichend; nur als Skalierungs-Randnotiz vermerkt, kein aktueller Fix nötig.
**Priorität: NICE**

---

## B. Cross-Page-Konsistenz (Preis/Trial/Whop-Rolle)

**Preis (15€/Monat, 135€/Jahr):** In `index.html`, `landing-v2.html`, `agb.html`, `js/i18n.js`,
`js/landing.js` überall derselbe Betrag, nur unterschiedlich formatiert (z. B. "15 €" vs.
"15,00 €"). **Keine echte Inkonsistenz**, reine Marketing-Formatierungs-Varianz.
Priorität: NICE (rein kosmetisch, keine Rechtsfrage)

**Trial-Bedingungen:** Marketing-Seiten (`index.html`, `landing-v2.html`) beschreiben den Trial
stark verkürzt ("Karte hinterlegen, keine Abbuchung"), während `agb.html` §4 und `refund.html`
§1/§3 die vollständige rechtliche Fassung tragen (Einmaligkeit pro Account,
Missbrauchsklausel, Widerruf-Interaktion). Das ist **normale und zulässige Verkürzung** auf
Marketing-Ebene — die eigentliche Kaufentscheidung fällt im Whop-Checkout, nicht auf der
Landing-Page, und die AGB sind von dort verlinkt. Kein Verstoß gegen §5 UWG, solange der
Whop-Checkout selbst (außerhalb dieses Repos, nicht prüfbar) vor der Zahlungspflicht auf die
vollständigen Bedingungen hinweist bzw. verlinkt — das solltest du einmal manuell im
Whop-Checkout-Flow gegenchecken, da ich das nicht einsehen kann.
Priorität: NICE (mit einem manuellen Whop-Checkout-Spotcheck als einzigem offenen Punkt)

**"Merchant of Record"-Begriff:** Nur in `agb.html`/`datenschutz.html` verwendet, auf
Marketing-Seiten nicht — dort nur "Zahlung sicher über Whop". Kein Compliance-Problem: der
MoR-Status ist eine vertragliche/datenschutzrechtliche Einordnung, die in die Rechtstexte
gehört, nicht in Marketing-Copy.
Priorität: erfüllt, keine Aktion nötig

**`agb.html#empfehlungsprogramm`-Anker:** verifiziert gültig (§11-Abschnitt existiert weiterhin
mit dieser ID).

---

## C. `/datenschutz`-Skill — fokussierter Durchlauf

### 1. Cookies/localStorage-Deklaration vs. Realität
Art. 13 DSGVO | ⚠️ Lücke
**Befund:** `cookies.html` behauptet wörtlich: *"Alle eingesetzten Technologien sind im
Folgenden vollständig aufgelistet"* und listet u. a. `stackr_*`, `stackr_settings`,
`stackr_plan` als Schlüssel-Präfix. Tatsächlich im Code verwendete Keys (Stichprobe aus
`rechnungen/js/app.js`, `eigenbelege/js/app.js`) sind u. a.: `oyi_active_company`,
`purchases`, `_oyi_lsmirror`, `_oyi_lsmirror_ts`, `agb_accepted`, `app_theme`,
`eb_sidebar_collapsed` — **kein einziger davon beginnt mit `stackr_`**, und mehrere
(`agb_accepted`, `app_theme`, `eb_sidebar_collapsed`, `_oyi_lsmirror`) tauchen in der
Cookie-Tabelle **gar nicht** auf.
**Bewertung:** Keine der ungenannten Daten ist sensibel (Theme-Präferenz, Sidebar-Zustand,
AGB-Zustimmungs-Timestamp, technischer Merge-Spiegel) — datenschutzrechtlich also kein
Verstoß in der Sache. Das Problem ist die **Vollständigkeits-Behauptung selbst**: sie ist
faktisch unzutreffend, was bei einer Prüfung (Aufsichtsbehörde, Abmahnung) als formaler Mangel
auffallen kann.
Empfehlung: Entweder Satz "vollständig aufgelistet" zu "beispielhaft, die wichtigsten
Kategorien" abschwächen, oder die Tabelle um die realen Keys ergänzen (kein `stackr_`-Präfix
im Code — der Text sollte das tatsächliche Namensschema nennen oder generisch von
"technischen Einstellungs-Keys" sprechen statt konkrete falsche Präfixe zu behaupten).
**Priorität: BALD**

### 2. Whop-Verantwortlichkeits-Status
Art. 28 DSGVO | ✅ inhaltlich plausibel, ⚠️ noch unbestätigt
Deckt sich mit Runde 1: `datenschutz.html` ordnet Whop korrekt als eigenständig
Verantwortlichen ein (kein AVV einschlägig); Bestätigungsanfrage an Whop ist in
`plan/whop-dpa-anfrage.md` vorbereitet, Versand steht noch aus. Kein neuer Befund, nur
Referenz für Vollständigkeit dieses Reports.

### 3. Upstash/Vercel-AVV
Art. 28 DSGVO | ✅ Standard-DPA extern bestätigt vorhanden
Aus Runde-1-Recherche bestätigt: Upstash (`upstash.com/trust/dpa.pdf`) und Vercel
(`vercel.com/legal/dpa`) bieten beide offizielle, GDPR/SCC/DPF-konforme Standard-DPAs.
Offen bleibt nur (außerhalb Code-Prüfbarkeit): ob euer konkreter Account-Plan das DPA
automatisch einschließt (Vercel-PDF deutete eine Pro/Enterprise-Bindung an) — das kannst nur
du im jeweiligen Dashboard verifizieren.
**Priorität: BALD**

### 4. Recht auf Löschung (Art. 17)
✅ Konform — `action: 'delete'` in `api/sync.js` löscht sowohl den Haupt-Snapshot als auch
(neu, Teil des WIP) die Anker-Liste. Bestätigt implementiert.

### 5. SRI-Lücke `ui-lab.html`
Art. 32 DSGVO / Supply-Chain | 🟢 Niedrig
`ui-lab.html:9` lädt `@tabler/icons-webfont` von jsDelivr **ohne** `integrity`-Attribut
(anders als `app.html`, `rechnungen/index.html`, `eigenbelege/index.html`, `lager/index.html`,
die SRI korrekt setzen). Da es sich um ein CSS-Stylesheet (kein Skript) handelt, ist das
Ausnutzungsrisiko gering (kein direkter Code-Execution-Pfad über CSS), aber bei
CDN-Kompromittierung theoretisch für Daten-Exfiltration über CSS-Selektoren nutzbar.
ui-lab.html ist laut Projekt-Kontext ein internes Design-Prototyp-Tool, keine Nutzer-Seite.
Empfehlung: SRI-Hash ergänzen (gleiches Muster wie in den anderen Dateien), 5-Minuten-Fix.
**Priorität: NICE**

### 6. Impressum, sonstige Datenschutz-Grundlagen
✅ Keine neuen Befunde ggü. Runde 1 (vollständig geprüft, siehe letzter Report).

---

## D. `/security-stackr`-Skill — fokussierter Durchlauf

### 1. CSP — Meta-Tag vs. HTTP-Header
🟡 MITTEL (Defense-in-Depth, kein akuter Exploit-Pfad)
`vercel.json` setzt zentrale Security-Header (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
HSTS, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`) — aber **keine
Content-Security-Policy** als HTTP-Header. CSP existiert ausschließlich als `<meta>`-Tag in
12 einzelnen HTML-Dateien. Das bedeutet: CSP greift erst nach dem Parsen des `<head>`, und
Directives wie `frame-ancestors`/`sandbox`/`report-uri` funktionieren über `<meta>` gar nicht
(werden vom Browser ignoriert). Praktisch abgefedert, weil `X-Frame-Options: DENY` bereits
Clickjacking global per Header abdeckt — der fehlende `frame-ancestors` in der Meta-CSP ist
also **nicht** die Lücke, die sie in anderen Setups wäre.
Empfehlung: `Content-Security-Policy` zusätzlich zentral in `vercel.json` setzen (gleicher
Wert wie in den Meta-Tags, ggf. striktester gemeinsamer Nenner), Meta-Tags können als
Fallback bleiben.
**Priorität: NICE** (robusteres Setup, kein akutes Loch)

### 2. `connect-src`-Unterschied `app.html` vs. `index.html`
✅ Kein Finding — korrekt spezifisch statt zu weit
`app.html` erlaubt `connect-src` zusätzlich `api.whop.com`, `*.public.blob.vercel-storage.com`,
`*.make.com` (weil die eigentliche App dorthin verbindet: Whop-API, Blob-Attachments,
Make.com-Webhooks — letzteres bewusst clientseitig, siehe `makecom-webhooks`-Memory).
`index.html` (Marketing-Landing) beschränkt auf `'self'`, weil dort keine dieser Verbindungen
gebraucht wird. Das ist **enger, nicht loser** als nötig pro Seite — vorbildlich, kein Fix.

### 3. Secrets & Server-Endpunkte
✅ Kein Finding — `WHOP_API_KEY`, `UPSTASH_REDIS_REST_TOKEN` etc. ausschließlich über
`process.env` in `api/sync.js`, keine hartcodierten Werte, keine Client-seitige Exposition
(`js/whop-auth.js` referenziert `WHOP_API_KEY` nur in einem Kommentar, nicht als Wert).

### 4. Cloud-Sync-Zugriffskontrolle
✅ Kein Finding — Whop-Token wird serverseitig gegen `https://api.whop.com/api/v2/me/has_access/`
verifiziert (`api/sync.js:50`), CORS ist auf die eigene Domain beschränkt
(`Access-Control-Allow-Origin: https://track-your-income-app.vercel.app`, nicht `*`), IP- und
User-Rate-Limiting vorhanden (429 bei Überschreitung) und gilt auch für die neuen
`anchor`/`anchor_pull`-Actions, da sie denselben Handler-Pfad nach denselben Checks durchlaufen.
Neue Anchor-Endpunkte validieren Eingaben strikt per Regex (`ID_RE`, `HASH_RE`), lehnen
Batches >1000 ab, StB-Readonly (`body.owner`) korrekt mit 403 blockiert.

### 5. Übrige 10 Kategorien der Skill-Checkliste
Nicht erneut vollständig durchlaufen — decken sich mit dem bereits in Runde 1 bzw. in früheren
Security-Audits (Memory: CSP-Härtung, Whop-Access-Gate-Fix) geprüften und bestätigten Stand.
Kein Hinweis auf neue Regressionen in den hier untersuchten WIP-Dateien.

---

## Zusammenfassung — Priorisierte Liste

| Prio | Thema | Nächster Schritt |
|---|---|---|
| 🟡 BALD | Verfahrensdoku fehlt Cloud-Anker-Beschreibung | ✅ erledigt 2026-07-26 — WIP committet (`f5c88d8`), §4 präzisiert + Änderungshistorie fortgeschrieben |
| 🟡 BALD | `cookies.html` "vollständig aufgelistet"-Behauptung stimmt nicht mit realen Key-Namen überein | ✅ erledigt 2026-07-26 (`0733e77`) — Tabelle auf 9 Kategoriezeilen umgebaut, deckt alle 32 realen Keys ab; Vollständigkeitszusage gilt jetzt den Kategorien |
| 🟡 BALD | Upstash/Vercel-DPA-Geltung für euren Plan unverifiziert | Selbst im Dashboard prüfen (aus Runde 1, hier bestätigt weiter offen) |
| 🔴 NEU | Vercel Blob nirgends als Empfänger genannt, "ausschließlich Upstash (Frankfurt, EU)" ist falsch | Offen — eigener Session-Prompt: `plan/session-prompt-vercel-blob-empfaenger.md`. Braucht vorab die Blob-Region aus der Vercel-Konsole |
| 🟢 NICE | CSP nur als Meta-Tag, nicht als HTTP-Header | ✅ erledigt 2026-07-26 (`f687a51`) — 14 routenspezifische Einträge in `vercel.json`, statisch + im Browser gegengeprüft |
| 🟢 NICE | `ui-lab.html` fehlt SRI-Hash auf CSS-Import | ✅ erledigt 2026-07-26 (`7364ba4`) |
| 🟡 BALD | Whop-Checkout-Flow — geprüft 2026-07-30, echter Befund: Stackr-AGB nicht verlinkt, kein Widerrufsverzicht-Hinweis, Button-Text „Beitreten"/„Zugang erhalten" §312j-fragwürdig (legal-reviewer: 🟡 GELB) | ✅ Prüfung erledigt, Fund offen — Whop-Eskalation (Entwurf in `## whop-checkout-spotcheck.md` Nachtrag) durch User verschicken, zusätzlich in Anwalts-Briefing Punkt (b)4 |
| 🟢 NICE | `ANCHOR_MAX`-Skalierungsgrenze bei sehr langjährigen Firmen | Nur beobachten, kein aktueller Fix |
| 🟢 NICE | `cookies.html` — 5 Kleinfunde (Stand-Datum, §25-Zitat, Abschnitt 5 rät Cookies statt Website-Daten zu löschen, jsDelivr-Wording, IndexedDB) | Offen — mit im Session-Prompt `plan/session-prompt-vercel-blob-empfaenger.md` |

**Gesamtbild Runde 2:** Keine 🔴 kritischen oder ❌ akuten Verstöße gefunden. Der neue
Cloud-Anker-Code ist technisch sauber (Datensparsamkeit, Art.-17-Löschung, Rate-Limits,
StB-Readonly alle korrekt mitgezogen) — die einzige Lücke ist, dass die Verfahrensdoku ihm
noch hinterherhinkt, was aber erst mit dem Commit akut wird. Der zweite Realbefund
(Cookie-Tabelle vs. tatsächliche Storage-Keys) ist eine Textungenauigkeit, keine
Datenschutzverletzung in der Sache. Security-seitig bestätigt dieser Durchlauf ausschließlich
bereits vorhandene gute Praxis, keine neuen Lücken.

---

## Nachtrag 2026-07-26 — Umsetzungssession

Punkte 1, 2, CSP und SRI sind abgearbeitet (siehe Statusspalte oben). Beim Umsetzen sind drei
Dinge aufgefallen, die im Audit-Durchlauf selbst nicht sichtbar waren:

**🔴 Vercel Blob als ungenannter Empfänger.** Der `legal-reviewer` fand beim Gegenlesen von
`cookies.html`, dass die Zusage „ausschließlich … bei Upstash (Frankfurt, EU)" nicht stimmt —
großes Ledger und Anhänge gehen zusätzlich an Vercel Blob, das in `cookies.html`,
`datenschutz.html` und `verfahrensdokumentation.html` nirgends als Empfänger auftaucht
(Art. 13 Abs. 1 lit. e DSGVO). Das wiegt schwerer als der ursprüngliche Anlass des Audits.
Eigener Session-Prompt, weil die Blob-Region erst aus der Vercel-Konsole geklärt werden muss.

**🟡 Cloud-Sync lief auf drei Unterseiten gar nicht.** `lager/`, `rechnungen/` und
`eigenbelege/` luden `whop-auth.js` und `stb-share.js`, aber nicht `cloud-sync.js` — obwohl
`whop-auth.js:329` `CloudSync.init()` aufruft und `stb-share.js:158` ohne `CloudSync` aussteigt.
Wer länger im Rechnungs- oder Lagermodul arbeitete, synchronisierte bis zum Wechsel nach
`app.html` nichts, und die Steuerberater-Freigabe war von dort nicht bedienbar. Gefixt in
`503497d` — inklusive `blob-attachments.js`, ohne die der Sync dort mit einem ReferenceError
abgebrochen wäre (`cloud-sync.js` ruft `BlobAttachments.*` in `_syncScope` ungeschützt auf).

**🟢 Beobachtung im Anker-Code, nicht gefixt.** `_pushAuditAnchors()` in `js/cloud-sync.js`
schreibt die Merkliste bereits gemeldeter IDs (`_saveAnchored`) erst nach der kompletten
Batch-Schleife. Bricht ein Batch mit != 200 ab (z. B. Rate-Limit — 40 Req/min, und die
Erstverankerung eines großen Logs braucht viele Batches), gehen die erfolgreichen Batches
desselben Laufs aus der Merkliste verloren und werden beim nächsten Sync erneut gesendet.
Fachlich harmlos (der Server dedupliziert über identische Hashes, `verifyAuditAnchors()`
wertet `uniq.length === 1` weiterhin als OK), kostet aber unnötig Requests und bläht die
Redis-Liste. Fix wäre `_saveAnchored` vor das `return` zu ziehen. Bewusst nicht in den
Commit gezogen, um fremden WIP unverändert zu übernehmen.

---

## whop-checkout-spotcheck.md

# Whop-Checkout-Spotcheck (macht der User selbst)

Stand: 2026-07-26. Offener Punkt aus `plan/vollaudit-runde2-2026-07-25.md` Abschnitt B
(„Trial-Bedingungen"). **Dauer: ~15 Minuten.** Kein Kauf nötig — man kann bis unmittelbar vor den
Bestell-Button gehen und dort abbrechen.

---

## Warum das jemand prüfen muss

Whop ist **Merchant of Record**: der Zahlungsvertrag läuft über Whop, die Dienstleistung ist unsere.
Der Bestellvorgang liegt damit auf `whop.com` — außerhalb dieses Repos und für eine Coding-Session
nicht einsehbar.

Die Marketing-Seiten (`index.html`, `landing-v2.html`) beschreiben die Testphase stark verkürzt:

> „Erst 7 Tage kostenlos testen — Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung.
> Danach 15 € im Monat. Das war's. Kein Kleingedrucktes, keine Tarif-Treppe."

Die vollständige Fassung steht in `agb.html` §4 und `refund.html` §1/§3: Einmaligkeit pro
Whop-Konto, Missbrauchsklausel, automatische Umwandlung in ein kostenpflichtiges Abo, Zusammenspiel
mit dem Widerrufsrecht nach §356 Abs. 5 BGB.

Diese Verkürzung auf Marketing-Ebene ist zulässig — die Kaufentscheidung fällt im Checkout, und die
AGB sind von der Landing-Page verlinkt. **Sie ist aber nur zulässig, solange der Checkout selbst vor
der Zahlungspflicht die vollständigen Bedingungen anzeigt oder verlinkt.** Ob Whop das tut, ist die
einzige verbleibende Unbekannte in dieser Kette.

### Rechtsgrundlagen, an denen der Checkout gemessen wird

| Norm | Was sie verlangt |
|---|---|
| **§312j Abs. 2 BGB** | Unmittelbar vor dem Bestell-Button: wesentliche Merkmale, **Gesamtpreis**, Laufzeit, Mindestlaufzeit — bei Trial-Abos gehört der Preis **nach** der Testphase dazu |
| **§312j Abs. 3 BGB** | Button eindeutig beschriftet („zahlungspflichtig bestellen" o. ä.). Ein bloßes „Start free trial" ohne Preisangabe daneben ist die klassische Abmahnfalle |
| **Art. 246a §1 EGBGB** | Vorvertragliche Pflichtinfos: Gesamtpreis, Laufzeit, Kündigungsbedingungen, Widerrufsrecht |
| **§356 Abs. 5 BGB** | Widerrufsrecht erlischt bei digitalen Inhalten nur mit **ausdrücklicher Zustimmung** + Kenntnisnahme des Verlusts |
| **§5 UWG** | Keine irreführende Angabe — hier: „Kein Kleingedrucktes" vs. Missbrauchsklausel in §4 AGB |

> **Wichtig zur Einordnung:** Ein Teil dieser Pflichten trifft Whop als MoR, nicht uns. Aber wenn
> der Checkout etwas anderes sagt als unsere AGB, ist das **unser** Problem — der Kunde schließt
> den Nutzungsvertrag mit uns.

---

## Vorbereitung

1. **Im privaten Fenster / ausgeloggt** öffnen. Mit dem eigenen Whop-Konto ist die Testphase
   womöglich schon verbraucht — dann sieht man nicht, was ein Neukunde sieht.
2. Screenshots machen (Beweisdokumentation, falls später jemand fragt).
3. **Nicht abschließen.** Bis zum Bestell-Button gehen, prüfen, abbrechen.

### Die zwei Checkout-Links

| Plan | URL | Erwartung |
|---|---|---|
| Monatlich | `https://whop.com/checkout/plan_iR6YIKLcychSZ` | 15,00 € / Monat inkl. MwSt., 7 Tage Trial |
| Jährlich | `https://whop.com/checkout/plan_b5IBQ1lecggOT` | 135,00 € / Jahr inkl. MwSt., 7 Tage Trial |

*(Zuordnung aus `index.html:579` bzw. `landing-v2.html:359` abgeleitet — im Checkout bitte
gegenprüfen, dass die Beträge zum jeweiligen Link passen.)*

---

## Checkliste

Für **beide** Pläne durchgehen.

### A — Preis und Laufzeit vor dem Button

- [x] Der Preis **nach** der Testphase steht sichtbar auf der Checkout-Seite (nicht erst nach dem Klick) — **✅ bestätigt 2026-07-27**: „Dann 15,00 €, beginnend am August 3, 2026." Sogar mit konkretem Datum, strenger als gefordert.
- [x] Der Betrag stimmt exakt mit `agb.html` §4 überein — **✅ 15,00 €/Monat bestätigt** (Screenshot Monats-Plan). Jahres-Plan (135 €) noch nicht separat gegengeprüft.
- [ ] **inkl. MwSt.** ist erkennbar — **⚠️ auf dem Checkout-Screen selbst NICHT sichtbar** (nur auf der Landing-Page davor). Weiter unten scrollen/prüfen, ob es doch noch auftaucht.
- [x] Testphasenlänge = **7 Tage** — **✅ bestätigt**: „7 Tage kostenlos"
- [x] Erkennbar, dass sich das Abo automatisch verlängert — **✅** „Gesamt nach Testlauf: 15,00 € pro Monat" impliziert Wiederkehr
- [x] Erkennbar, wann die erste Abbuchung erfolgt — **✅ sogar mit Datum**, s.o.

### B — Button-Beschriftung (§312j Abs. 3 BGB)

- [ ] Button ist eindeutig als zahlungspflichtig erkennbar — **⚠️ fraglich.** Exakte Beschriftung: **„Beitreten"** (nicht „zahlungspflichtig bestellen" o.ä.)
- [x] Notiere die **exakte Beschriftung**: `Beitreten`
- [ ] Da kein Preis *direkt am/im* Button steht, sondern nur darüber („Gesamt fällig heute: 0,00 € / Gesamt nach Testlauf: 15,00 € pro Monat") — **Risiko notiert, s. „Ergebnis" unten.** Nicht durch uns änderbar (Whops Formular), nur zu dokumentieren.

### C — Verlinkung unserer Bedingungen

- [ ] Unsere **AGB** sind vom Checkout aus erreichbar (verlinkt oder eingeblendet) — **noch nicht geprüft**, im Screenshot nur der obere Teil der Seite sichtbar (Google Pay + Kartenformular). Weiter runterscrollen vor dem Abbrechen.
- [ ] Unsere **Widerrufsbelehrung / refund.html** ist erreichbar — **noch nicht geprüft**, dito
- [ ] Falls nur Whops eigene `buyer-terms` verlinkt sind: prüfen, ob dort auf die Verkäufer-Bedingungen verwiesen wird
- [ ] Notiere, **welche** Links tatsächlich da sind: `____________________________`

### D — Widerrufsrecht (§356 Abs. 5 BGB)

- [ ] Gibt es eine Checkbox/Zustimmung zum sofortigen Ausführungsbeginn? — **noch nicht geprüft**, evtl. weiter unten auf der Seite oder erst nach Karteneingabe sichtbar
- [ ] Wird auf den **Verlust des Widerrufsrechts** hingewiesen?
- [ ] Falls **nein**: notieren. `refund.html` §1 behauptet aktuell, der Nutzer erkläre das „durch die Aktivierung des Pro-Plans" — wenn der Checkout diese Erklärung gar nicht einholt, trägt der Text nicht.

### E — Kündigung

- [ ] Im Checkout oder im Whop-Konto erkennbar, dass jederzeit über das Whop-Konto gekündigt werden kann
- [ ] Kündigung ist ohne Support-Kontakt auffindbar (Whop unterliegt als Plattform selbst §312k BGB Kündigungsbutton)

### F — Verkäufer-Dashboard (unabhängig vom Checkout prüfbar)

Im Whop-Seller-Dashboard unter der Plan-Konfiguration:

- [ ] Trial-Länge steht auf **7 Tage** bei beiden Plänen
- [ ] Preise stimmen (15 € / 135 €)
- [ ] Falls Whop ein Feld für eigene Terms/Refund-Policy anbietet: sind unsere URLs eingetragen?
      (`https://track-your-income-app.vercel.app/agb.html`, `.../refund.html`)

---

## Zusätzlicher Fund, der hier mit reingehört

`index.html` wirbt mit **„Kein Kleingedrucktes"**, während `agb.html` §4 enthält:

- Testphase nur **einmal pro Nutzer bzw. Whop-Konto**
- **Missbrauchsklausel**: bei Anhaltspunkten für Mehrfachnutzung kann der Zugang verweigert oder das
  Konto gesperrt werden

Das ist kein akuter Verstoß — „kein Kleingedrucktes" ist erkennbar werbliche Zuspitzung und bezieht
sich im Kontext auf die Preisstruktur („keine Tarif-Treppe"). Es ist aber die Art Formulierung, die
bei einer Abmahnung als Erstes zitiert wird.

- [ ] Entscheiden: so lassen, oder zu „keine versteckten Kosten" / „keine Tarif-Treppe" entschärfen

*(Reine Textänderung, kann eine Coding-Session in 2 Minuten machen — sag Bescheid.)*

---

## Ergebnis eintragen

Nach dem Durchgang hier vermerken und in `plan/vollaudit-runde2-2026-07-25.md` die entsprechende
Zeile in der Prioritäten-Tabelle mit „✅ erledigt <Datum>" ergänzen.

**Datum des Checks:** 2026-07-27 (Monats-Plan, Teil 1 — bis zum Kartenformular, nicht abgeschlossen)

**Ergebnis:**

- [ ] Alles sauber — keine Abweichung zwischen Checkout und unseren Rechtstexten
- [x] Abweichungen/offene Fragen gefunden (s.u.) → **weiter in eigener Session, siehe
      `## session-prompt-whop-checkout-nachpruefung.md`** weiter unten in dieser Datei

**Notizen (Stand 2026-07-27):**

```
Screenshot 1 (Landing-Page, Preiskarte): 15,00 €/Monat, „inkl. MwSt. · Jederzeit kündbar",
„Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung", Button „Jetzt 7 Tage kostenlos
testen →".

Screenshot 2 (echter Whop-Checkout, whop.com/checkout/1wRLkZJFqiCtyCwQfL-...):
- „7 Tage kostenlos" / „Dann 15,00 €, beginnend am August 3, 2026."
- „Gesamt fällig heute: 0,00 €" / „Gesamt nach Testlauf: 15,00 € pro Monat"
- Zahlungsformular (Google Pay, Karte, Rechnungsdetails inkl. Land)
- Button: „Beitreten"
- User ist an dieser Stelle ausgestiegen (nicht abgeschlossen) — Rest der Seite
  (AGB-Link, Widerrufs-Checkbox, MwSt.-Vermerk) nicht mehr gesehen.

Bewertung: Preis/Datum/Laufzeit vorbildlich transparent (A komplett grün, sogar über
Soll-Anforderung hinaus). Zwei offene Punkte:
1. Button „Beitreten" statt einer Formulierung, die die Zahlungspflicht selbst benennt
   (§312j Abs. 3 BGB) — Whops Standardformular, von uns nicht änderbar.
2. C/D (AGB-/Widerrufs-Verlinkung, Zustimmungs-Checkbox) schlicht noch nicht gesehen,
   nicht negativ festgestellt — Seite muss weiter gescrollt werden.
Kein akuter Befund, zwei Fragen für den nächsten Durchlauf bzw. eine rechtliche Einordnung.
```

**Nachtrag 2026-07-30 (Nachprüfungs-Session, per Browser-Pane, kein Login/Kauf):**

```
1. Button-Text „Beitreten"/„Zugang erhalten" — legal-reviewer-Ergebnis: 🟡 GELB, Tendenz Rot.
   OLG Köln: Preistext neben Button heilt Mangel nicht, Wortlaut AUF dem Button zählt.
   KG-Berlin-Ausnahme (Blinkist „starten") greift nicht, da unser Button finaler Auslöser ist,
   kein Zwischenschritt. Bei Verstoß: §312j Abs. 4 BGB — Vertrag ggf. unwirksam. Trifft auch
   Stackr (UWG-Mitstörerhaftung + Umsatz-Rückabwicklung über Whop-MoR). Quellen/Details siehe
   Anwalts-Briefing-Ergänzung unten.

2. Checkout C/D geprüft (Monats- UND Jahres-Plan, identisches Bild):
   - C: „Stackr's Allgemeine Geschäftsbedingungen" nur Fließtext, KEIN Link (per DOM-Check
     bestätigt: kein href). Verlinkt sind nur Whops eigene „Bedingungen"/„Datenschutz"
     (whop.com/tos, whop.com/privacy) — nicht Stackrs AGB, nicht Stackrs Datenschutz, kein
     Widerruf-Link. Kunde kann Stackr-AGB vom Checkout aus nicht erreichen.
   - D: Kein Widerrufsverzicht-Checkbox/-Hinweis — Wort „Widerruf" kommt auf der Checkout-Seite
     gar nicht vor (per DOM-Check bestätigt: 0 Checkbox-Inputs, kein Treffer für „widerruf").
   - Bonus-Fund: Button-Text ist plan-abhängig unterschiedlich — Monatsplan „Beitreten",
     Jahresplan „Zugang erhalten". Beide gleiches §312j-Problem, nicht nur ein Plan betroffen.
   - E (Kündigungsweg im Whop-Konto) und F (Seller-Dashboard: Trial-Länge/Preise/Terms-URL je
     Plan) NICHT geprüft — brauchen User-eigenen Whop-Login bzw. Seller-Zugang.

3. Jahres-Plan gegengecheckt: 135,00 €/Jahr bestätigt, 7 Tage Trial, „Gesamt fällig heute
   0,00 €", Ablaufdatum genannt — Abschnitt A auch hier komplett grün.

Einschätzung: Fehlender AGB-Link + fehlender Widerrufsverzicht-Hinweis sind der dickere Fund,
nicht nur die Button-Text-Frage — beides Whop-Template-seitig, nicht in Stackr-Code fixbar.
Nächste Schritte: (1) an Anwalts-Briefing anhängen (unten ergänzt), (2) Whop-Eskalation
(Entwurftext unten) durch User verschicken, (3) E/F durch User selbst nachprüfen.
```

**Whop-Eskalation (Entwurf, durch User zu verschicken — Claude verschickt nichts selbst):**

```
Betreff: EU-Compliance-Lücken im Checkout-Template (Merchant: Stackr)

Hallo Whop-Team,

beim Checkout unserer Pläne (plan_iR6YIKLcychSZ, plan_b5IBQ1lecggOT) sind uns drei
EU-Verbraucherschutz-Lücken aufgefallen, die wir als Merchant nicht selbst anpassen können:

1. Der Bestell-Button ist mit „Beitreten" (Monatsplan) bzw. „Zugang erhalten" (Jahresplan)
   beschriftet. §312j Abs. 3 BGB (DE) verlangt für den finalen, zahlungsauslösenden Button
   eine eindeutige Formulierung wie „zahlungspflichtig bestellen" — der Preis-Hinweis direkt
   über dem Button reicht laut deutscher Rechtsprechung (OLG Köln) nicht aus, wenn der
   Button-Text selbst keinen Zahlungsbezug herstellt.
2. Auf der Checkout-Seite wird „Stackr's Allgemeine Geschäftsbedingungen" nur als Fließtext
   erwähnt, aber nicht verlinkt — Kund:innen können unsere AGB vor Vertragsschluss nicht
   erreichen.
3. Es gibt keinen Hinweis/keine Checkbox zum Widerrufsverzicht bei sofortigem
   Ausführungsbeginn digitaler Leistungen — für EU/DE-Kund:innen rechtlich relevant.

Könnt ihr das Checkout-Template für EU/DE-Merchants anpassen (button-Text konfigurierbar
machen, Merchant-eigene AGB/Widerruf-Links einbindbar machen, Widerrufsverzicht-Checkbox
optional aktivierbar)? Für Rückfragen stehen wir zur Verfügung.

Danke, Stackr-Team
```

---

## ~~session-prompt-whop-checkout-nachpruefung.md~~ (erledigt 2026-07-30)

# Prompt für neue Session (copy-paste) — Whop-Checkout: offene Fragen aus dem ersten Durchlauf

Kontext: Der Whop-Checkout-Spotcheck (`## whop-checkout-spotcheck.md` weiter oben in dieser Datei)
wurde am 2026-07-27 vom User teilweise durchgeführt (Screenshots, Monats-Plan, bis zum
Kartenformular — nicht abgeschlossen/gekauft). Abschnitt A (Preis/Laufzeit/Datum) ist **komplett
grün**, sogar über die Mindestanforderung hinaus. Zwei Punkte sind offen:

## 1. Rechtliche Einordnung: Button-Text „Beitreten"

Der Bestell-Button auf dem echten Whop-Checkout heißt **„Beitreten"**, nicht z. B.
„zahlungspflichtig bestellen". §312j Abs. 3 BGB verlangt eine Beschriftung, die die
Zahlungspflicht erkennbar macht. Direkt über dem Button steht aber unmissverständlich:

> Gesamt fällig heute: 0,00 €
> Gesamt nach Testlauf: 15,00 € pro Monat

**Aufgabe:** `legal-reviewer`-Agent einsetzen mit der konkreten Frage: Reicht diese
Preis-Auszeichnung unmittelbar über dem Button, um die §312j-Abs.-3-Anforderung zu erfüllen, auch
wenn der Button-Text selbst („Beitreten") die Zahlungspflicht nicht benennt? Es gibt
einschlägige Rechtsprechung zu Trial-Buttons bei SaaS-Abos (z. B. LG-Entscheidungen zu
„kostenlos testen"-Buttons ohne Preis) — der Agent soll das einordnen, nicht neu erfinden.

**Wichtig:** Das ist Whops Checkout-Formular, nicht unser Code — wir können den Button-Text nicht
ändern. Ergebnis ist eine **Risikoeinschätzung**, keine Code-Änderung. Bei echtem Risiko: Punkt für
das Anwalts-Briefing (`## session-prompt-anwalt-briefing.md` weiter oben) vormerken, dort steht
ohnehin die §11-/§356-Frage an.

## 2. Rest der Checkliste durchgehen (Abschnitte C, D, E, F)

Der User ist vor dem Kartenformular ausgestiegen — noch nicht gesehen:

- **C** — sind AGB/Widerrufsbelehrung vom Checkout aus verlinkt? (weiter runterscrollen, bevor
  abgebrochen wird)
- **D** — gibt es eine Checkbox/einen Hinweis zum Widerrufsverzicht bei sofortigem
  Ausführungsbeginn?
- **E** — Kündigungsweg im Whop-Konto
- **F** — Whop-Seller-Dashboard: Trial-Länge/Preise pro Plan, eigene Terms-URLs hinterlegt?

Diese Session sollte den User **anleiten**, den Check zu Ende zu führen (privates Fenster, gleicher
Checkout-Link `https://whop.com/checkout/plan_iR6YIKLcychSZ`, diesmal bis kurz vor „Beitreten"
durchscrollen) — nicht selbst einloggen oder kaufen.

## 3. Jahres-Plan gegenprüfen

Bisher nur der **Monats-Plan** (15 €) verifiziert. `https://whop.com/checkout/plan_b5IBQ1lecggOT`
sollte 135,00 €/Jahr zeigen — kurzer Gegencheck, kein neuer Themenblock.

## Abschluss

- Ergebnis in den „Notizen"-Block von `## whop-checkout-spotcheck.md` (oben in dieser Datei)
  nachtragen, nicht überschreiben — anhängen.
- Bei echtem Befund: Zeile in der Prioritäten-Tabelle von `## vollaudit-runde2-2026-07-25.md`
  aktualisieren.
- Diesen Abschnitt (`session-prompt-whop-checkout-nachpruefung.md`) nach Abschluss als erledigt
  markieren (Überschrift durchstreichen), nicht löschen.

---

**Modell-Empfehlung: Sonnet 5** für den organisatorischen Teil (Checkliste anleiten), aber der
`legal-reviewer`-Agent-Call in Punkt 1 ist der eigentliche Kern der Session.

---

## whop-dpa-anfrage.md

# Whop-DPA/AV-Vertrag — Recherche-Ergebnis + Anfrage-Entwurf

Stand: 2026-07-24. Ergebnis der Recherche-Session aus `plan/session-prompt-whop-dpa-anfrage.md`.
Nur Recherche + Textentwurf — nichts wurde an Whop verschickt.

## 1. Klärung: AVV oder Joint-Controller-Nachweis?

**Ergebnis: Weder klassischer AVV noch Joint-Controller-Vertrag ist das passende Instrument
— sondern eine schriftliche Bestätigung/Nachweis des Verantwortlichkeits-Status samt
Transfermechanismus.**

Begründung:
- Whops öffentliche Datenschutzerklärung (https://whop.com/privacy/) beschreibt Whop als
  Verarbeiter *seiner eigenen* Vertragsbeziehungen (Login, Zahlung, Fraud/Dispute-Handling)
  auf Basis "Performance of a contract" — das ist die Sprache eines **eigenständig
  Verantwortlichen**, nicht eines weisungsgebundenen Auftragsverarbeiters. Es gibt **keinen
  öffentlichen Hinweis auf ein Merchant-seitiges AVV-Self-Service-Angebot** und **keine
  öffentliche Subprozessoren-Liste** (anders als z. B. bei Stripe, Notion, Intercom, die
  sowas veröffentlichen).
- Ein von der Google-Suche zunächst angezeigtes "Whop DPA"-Dokument
  (`kshi418qhedyw8fcqxft.apps.whop.com/dpa`) ist **keine offizielle Whop-Rechtsseite**,
  sondern eine auf Whops App-Subdomain gehostete Drittanbieter-App (Titel "Data Processing
  Agreement - Replit") — **nicht verwenden, nicht zitieren.**
- Die aktuelle Einordnung in `datenschutz.html` (Ziffer 5+7: Whop = eigenständig
  Verantwortlicher, kein AVV einschlägig) ist damit **plausibel und im Einklang mit dem, was
  öffentlich über Whops Datenverarbeitungs-Modell einsehbar ist** — aber bislang nicht von
  Whop selbst schriftlich bestätigt.

→ Die Anfrage an Whop sollte daher **keine "AVV-Anfrage"** sein (das würde ins Leere laufen,
da Whop dafür keinen erkennbaren Prozess anbietet), sondern eine **Bestätigungsanfrage**:
Rolle (Verantwortlicher) bestätigen + Transfermechanismus (SCC / EU-US DPF) für EU-Nutzerdaten
benennen lassen. Das Ergebnis dient als Beleg/Anlage zur eigenen Verfahrensdokumentation und
für die Anwaltsprüfung.

## 2. Recherchierter Kontaktweg bei Whop

- Es gibt **keinen dedizierten Merchant-Compliance-/Legal-Kontakt oder Trust Center** bei
  Whop (kein `security.whop.com` o. ä. gefunden).
- Einziger verifizierter Kontaktweg für rechtliche/GDPR-Anfragen: **support@whop.com**
  (laut Privacy Policy, Abschnitt "Contact Us" — https://whop.com/privacy/).
- Relevante Referenzdokumente zum Zitieren in der Anfrage:
  - Privacy Policy: https://whop.com/privacy/
  - Terms of Service: https://whop.com/tos/
  - Developer/API Terms: https://whop.com/tos-developer-api/
  - Buyer Terms: https://whop.com/buyer-terms/ (bereits in `agb.html` referenziert)

## 3. Anfrage-Text (Copy-Paste, Deutsch)

Betreff: GDPR-Auskunft — Bestätigung Verantwortlichkeits-Status & Transfermechanismus (Whop-Merchant-Account)

```
Hallo Whop-Team,

wir betreiben über Whop die App "Stackr" (Merchant: Secondlife Vintage — Einzelunternehmen,
Jonathan Reck, Deutschland) und nutzen Whop für Login (OAuth) sowie die Zahlungsabwicklung
unseres Pro-Abonnements.

Für unsere Datenschutzerklärung (Art. 13/28 DSGVO) benötigen wir eine schriftliche
Bestätigung zu zwei Punkten:

1. Bestätigen Sie, dass Whop hinsichtlich der bei Login und Zahlung anfallenden
   personenbezogenen Daten unserer Endnutzer (E-Mail, Profildaten, Zahlungsdaten) als
   eigenständig Verantwortlicher im Sinne der DSGVO auftritt (und nicht als
   Auftragsverarbeiter für uns)?

2. Welchen Transfermechanismus nutzt Whop für die Übermittlung dieser Daten in die USA
   (EU-Standardvertragsklauseln nach Art. 46 DSGVO und/oder EU-US Data Privacy Framework)?
   Ist Whop Inc. aktuell unter dem EU-US DPF zertifiziert?

Eine kurze schriftliche Bestätigung (E-Mail reicht) für unsere Unterlagen wäre ausreichend.

Vielen Dank,
Jonathan Reck
Secondlife Vintage — Einzelunternehmen
```

## 4. Anfrage-Text (Copy-Paste, Englisch — falls Support nur Englisch bearbeitet)

Subject: GDPR inquiry — confirmation of controller status & transfer mechanism (Whop merchant account)

```
Hello Whop team,

We run the app "Stackr" via Whop (Merchant: Secondlife Vintage — sole proprietorship,
Jonathan Reck, Germany) and use Whop for login (OAuth) and payment processing of our
Pro subscription.

For our privacy policy (GDPR Art. 13/28) we need written confirmation on two points:

1. Please confirm that Whop acts as an independent data controller (not as our data
   processor) with respect to the personal data of our end users processed during login
   and payment (email, profile data, payment data).

2. Which transfer mechanism does Whop rely on for transferring this data to the US
   (EU Standard Contractual Clauses under Art. 46 GDPR and/or the EU-US Data Privacy
   Framework)? Is Whop Inc. currently certified under the EU-US DPF?

A brief written confirmation (email is sufficient) for our records would be enough.

Thank you,
Jonathan Reck
Secondlife Vintage — sole proprietorship
```

## 5. Nächster Schritt

Versand macht der User selbst über support@whop.com (oder Merchant-Dashboard-Support-Kanal,
falls vorhanden). Antwort danach in `datenschutz.html` Ziffer 5/7 als Beleg vermerken bzw.
als Anlage für die laufende Anwaltsprüfung (P0-6) bereitstellen.

---

## 2026-07-juli.md

# Juli 2026 — Fundament

North Star: 300 zahlende Abos bis 31.12. · **Monatsziel: ~20 zahlend** · Fokus: Offline→Web-Funnel scharf machen, SEO-Skelett legen, Founder-Kanäle live.

> Zuerst messen, dann bauen. Alles hängt an einer Zahl: **Wie viele aktive Offline-Nutzer gibt es und wie erreichen wir sie?** Woche 1 klärt das.

---

## Woche 1 — Realität messen [P0]

**Kontext:** Die gesamte Ramp beruht auf der Annahme, dass es eine konvertierbare Offline-Basis gibt. Diese Annahme muss zuerst validiert werden, sonst plant der Rest auf Sand.

**Schritte:**
1. Ermittle, wie viele aktive Nutzer die Offline-Version realistisch hat (Download-Zahlen, ggf. anonyme Telemetrie, Whop-Konten, E-Mail-Liste — was auch immer existiert).
2. Prüfe, welche Kontaktkanäle zu diesen Nutzern existieren: E-Mail-Adressen? In-App-Hinweis möglich? Nur Website?
3. Prüfe die aktuelle Landing (`landing.html` + `landing-v2.html`): Wird der Sprung Offline → Web-Abo (15 €, Cloud-Sync-Mehrwert) überhaupt erklärt?
4. Lege eine simple Mess-Baseline an: aktuelle zahlende Abos, Trial-Starts, Web-Traffic-Quelle (falls Analytics vorhanden — sonst als Lücke notieren).

**Akzeptanzkriterium:** Ein 1-Seiten-Dokument mit: geschätzte Offline-Basis, verfügbare Kontaktkanäle, Ist-Zahl zahlender Abos, größte Funnel-Lücke. Daraus abgeleitet: ist 300 realistisch oder muss die Ramp angepasst werden?

---

## Woche 2 — Offline→Web-Brücke bauen [P0]

**Kontext:** Der billigste Kunde ist der, der Stackr schon nutzt. Der Web-Mehrwert (Cloud-Sync, Zugriff von überall, kein manuelles Backup) muss dort sichtbar werden, wo Offline-Nutzer sind.

**Schritte:**
1. Mit `stackr-marketing`: Entwirf die Kernbotschaft „Warum von Offline auf Web-Abo wechseln" — konkret der Mehrwert, ehrlich, per Du. 3 Varianten.
2. Platziere einen dezenten, nicht-nervigen Upgrade-Hinweis in der Offline-Version bzw. auf der Website (je nachdem, was Woche 1 als Kanal ergab).
3. Falls E-Mail-Adressen existieren: mit `stackr-marketing` eine kurze, ehrliche Ankündigungs-Mail entwerfen (kein Hard-Sell) — **Entwurf, Versand erst nach deinem Go.**
4. Landing-Pricing-Abschnitt überarbeiten lassen: Offline gratis vs. Web 15 €/135 € klar gegenübergestellt, Jahres-Ersparnis (45 €) sichtbar.

**Achtung (Realitäts-Check):** Bereits **installierte** Offline-Versionen lassen sich evtl. nicht nachträglich mit In-App-Hinweisen erreichen (kein Auto-Update / kein Phone-Home). Kläre in Woche 1, welcher Kanal Bestandsnutzer real erreicht — wenn nur die Website/Download-Seite bleibt, ist das der Haupt-Touchpoint, nicht die App selbst.

**Akzeptanzkriterium:** Offline-Nutzer haben mindestens einen sichtbaren, ehrlichen Pfad zum Web-Abo über den real verfügbaren Kanal. Landing erklärt den Unterschied in <10 Sek. Kein erfundener Claim. Nichts wurde ohne Freigabe versendet/live geschaltet.

---

## Woche 3 — SEO-Skelett [P0]

**Kontext:** SEO ist der günstigste, mit der Zeit wertvollste Kanal. Wir legen die Struktur, die über Monate rankt. Fokus auf Kaufabsicht + Nische, nicht generischer Ratgeber-Content (den beantwortet die KI).

**Schritte:**
1. Keyword-Liste (per WebSearch) mit Kaufabsicht + Nische: „Buchhaltung GbR", „Buchhaltungssoftware offline", „Buchhaltung Schweiz Freelancer", „sevDesk Alternative", „lexoffice Alternative günstig", „Buchhaltung Kleinunternehmer Software".
2. Mit `stackr-marketing`: 2 Vergleichsseiten entwerfen — „Stackr vs. sevDesk" und „Stackr vs. lexoffice". Ehrlich, faktenbasiert (Feature-Matrix aus `Web 1.7`-Codebase belegen), USPs (Offline, GbR, Preis) betonen. **Keine falschen Behauptungen über Konkurrenz.**
3. Technisches SEO-Minimum prüfen: `<title>`, `meta description`, `<h1>`, saubere URLs, `lang="de"` — auf Landing + neuen Seiten.
4. Sicherstellen, dass die Seiten für AI-Search sauber strukturiert sind (klare Frage→Antwort-Blöcke, Feature-Tabellen).

**Akzeptanzkriterium:** Keyword-Liste (10–15 Terms) priorisiert nach Absicht × Aufwand. 2 Vergleichsseiten als Entwurf, jede Behauptung belegt oder als `[BELEG NÖTIG]` markiert. Technisches SEO-Minimum auf allen Marketing-Seiten erfüllt.

---

## Woche 4 — Founder-Kanäle live [P1]

**Kontext:** Persönliches LinkedIn-Profil bringt 5–10× mehr Reichweite als eine Firmenseite. Kurzvideo bringt Reichweite bei jungen Selbstständigen. Beides kostet nur Zeit.

**Schritte:**
1. LinkedIn-Profil des Gründers als „baut Stackr" positionieren (Bio, Banner). Mit `stackr-social`: 5 LinkedIn-Post-Ideen (Gründer-Perspektive, Buchhaltungs-Pains der Zielgruppe, 1 Contrarian Take).
2. Mit `stackr-social`: 3 TikTok/Reels-Skripte (Buchhaltungs-Pain → Aha-Moment mit Stackr, Hook in 2 Sek.). Aktuelle Formate per WebSearch prüfen.
3. Posting-Rhythmus festlegen: 2–3 LinkedIn-Posts/Woche, 2–3 Kurzvideos/Woche ab August. Kleiner Redaktionskalender.
4. Eine Nischen-Community identifizieren und beobachten (nicht sofort posten): wo halten sich GbR-/Reseller-/Freelancer-Zielkunden auf.

**Akzeptanzkriterium:** LinkedIn-Profil steht, 5 Post-Entwürfe + 3 Video-Skripte liegen bereit, Redaktionskalender für August existiert. Keine Behauptung ohne Beleg.

---

## Review-Punkte

**Review Mitte Juli (nach Woche 2):**
- Zahlende Abos jetzt: ____ (Start: ____)
- Offline-Basis-Schätzung: ____ / Kontaktkanal vorhanden? ____
- Ist die 300-Ramp realistisch? Falls nein → Zielzahlen in [README](README.md) anpassen.

**Review Ende Juli (nach Woche 4):**
- Zahlende Abos: ____ (Ziel ~20)
- Trial-Starts: ____ → daraus konvertiert: ____
- Vergleichsseiten live? Erste Impressionen? ____
- Bester Frühindikator-Kanal: ____ → im August verstärken.
- **Kurskorrektur:** Was hat gezogen, was nicht → August-Prioritäten anpassen.

---

## 2026-08-august.md

# August 2026 — Konversions-Welle

North Star: 300 bis 31.12. · **Monatsziel: ~55 kumuliert zahlend** (+35) · Fokus: Bestandsnutzer aktiv konvertieren, erste SEO-Seiten live bringen, Content-Rhythmus starten.

> Juli hat das Fundament gelegt. August dreht am größten Hebel: die Offline-Basis in zahlende Web-Nutzer umwandeln, solange die Aufmerksamkeit frisch ist.

---

## Woche 1 — Bestands-Konversion aktiv [P0]

**Kontext:** Der Offline→Web-Pfad steht seit Juli. Jetzt aktiv nutzen, nicht passiv warten.

**Schritte:**
1. Falls E-Mail-Liste vorhanden: die in Juli entworfene Ankündigungs-Mail (nach deiner Freigabe) versenden — ehrlicher Web-Mehrwert + 7-Tage-Trial. Mit `stackr-marketing` ggf. finalisieren.
2. In-App/Website-Upgrade-Hinweis auf Sichtbarkeit + Klarheit prüfen; A/B-Idee: zwei Botschaften gegeneinander (Cloud-Sync vs. „überall zugreifen").
3. Mit `stackr-marketing`: kurze FAQ „Offline vs. Web — was lohnt sich für mich?" für die Landing.

**Akzeptanzkriterium:** Bestandsnutzer wurden mindestens einmal aktiv (nicht nur passiv) auf das Web-Abo hingewiesen. Klick-/Conversion-Zahl wird gemessen (oder Lücke notiert).

---

## Woche 2 — SEO-Seiten live + erweitern [P0]

**Kontext:** Vergleichsseiten aus Juli veröffentlichen und die Nische ausbauen.

**Schritte:**
1. Die 2 Vergleichsseiten (Stackr vs. sevDesk / lexoffice) nach Faktencheck live nehmen.
2. Mit `stackr-marketing`: 2 weitere Seiten — „Buchhaltung für GbR" (USP-Nische) + „Buchhaltung offline / ohne Cloud" (USP-Nische). Kaufabsicht-orientiert.
3. Interne Verlinkung: Landing ↔ Vergleichsseiten ↔ Nischen-Seiten. Sitemap/Indexierung prüfen.

**Akzeptanzkriterium:** 4 SEO-Seiten live, intern verlinkt, technisch indexierbar. Jede Behauptung belegt.

---

## Woche 3 — Content-Rhythmus [P1]

**Kontext:** Reichweite kommt von Konstanz, nicht von einem viralen Treffer.

**Schritte:**
1. Redaktionskalender abarbeiten: 2–3 LinkedIn-Posts + 2–3 Kurzvideos, mit `stackr-social`.
2. In 1 identifizierter Nischen-Community anfangen, ehrlich zu helfen (Fragen beantworten, Stackr nur wo wirklich passend nennen).
3. Jeden Post mit klarem CTA (Trial starten / Offline testen).

**Akzeptanzkriterium:** Content-Woche vollständig veröffentlicht (nach deiner Freigabe), Engagement notiert, kein Spam-Verhalten in Communities.

---

## Woche 4 — Trial→Paid schärfen [P1]

**Kontext:** Reichweite bringt Trials — aber nur konvertierte Trials zählen aufs Ziel.

**Schritte:**
1. Trial-Erlebnis prüfen: Bekommt ein Trial-Nutzer schnell einen Aha-Moment (erste EÜR/Rechnung/Sync)?
2. Mit `stackr-marketing`: kurze Trial-Onboarding-/Erinnerungs-Mail-Sequenz entwerfen (Tag 1, Tag 5) — Wert zeigen, an Trial-Ende erinnern. **Entwurf, Versand nach Go.**
3. Reibungspunkte im Checkout (Whop) notieren.

**Akzeptanzkriterium:** Trial→Paid-Pfad hat mindestens eine aktive Erinnerung/Hilfe. Aha-Moment ist im Trial erreichbar. Reibungsliste existiert.

---

## Review-Punkte

**Review Mitte August:** Abos: ____ · Bestands-Konversion Klicks/Sales: ____ · beste Botschaft: ____
**Review Ende August:** Abos: ____ (Ziel ~55) · Trial→Paid-Rate: ____ · bester Kanal: ____ · SEO erste Rankings? ____ · **Kurskorrektur** für September (Azubi startet → mehr Kapazität).

---

## 2026-09-september.md

# September 2026 — Content-Maschine

North Star: 300 bis 31.12. · **Monatsziel: ~100 kumuliert zahlend** (+45) · Fokus: Kapazität hoch (Azubi startet), Content-Output verdoppeln, Community-Traktion.

> Ab jetzt hilft der Azubi (Bankkaufmann). Nutze die Extra-Hände für Ausführung: Content-Produktion, Community-Präsenz, SEO-Fleißarbeit — während du Strategie + Freigaben behältst.

---

## Woche 1 — Azubi-Onboarding auf den Plan [P0]

**Kontext:** Neue Kapazität ist nur wertvoll, wenn sie sauber angedockt ist. Der Azubi soll wiederholbare Ausführung übernehmen.

**Schritte:**
1. Definiere, welche Wochen-Items der Azubi eigenständig ausführen kann (Content nach Agent-Vorlage posten, Community beantworten, SEO-Seiten einpflegen).
2. Freigabe-Regel festhalten: Entwürfe kommen zu dir, Veröffentlichung nach Go (deckt sich mit den Agent-Guardrails).
3. Der Bankkaufmann-Hintergrund ist Gold für Content-Glaubwürdigkeit (Steuer/Finanz-Themen) — als Co-Autor für LinkedIn nutzen.

**Akzeptanzkriterium:** Azubi hat eine klare Liste eigenständiger Aufgaben + Freigabe-Regel. Mindestens 1 Content-Stück von ihm/ihr (mit `stackr-social`) produziert.

---

## Woche 2 — Content-Output verdoppeln [P1]

**Schritte:**
1. LinkedIn 3–4 Posts/Woche, Kurzvideo 3–4/Woche (Azubi + `stackr-social`).
2. Mit `stackr-marketing`: 2 neue SEO-Seiten (weitere Nische/Long-Tail aus der Juli-Keyword-Liste, z. B. „Buchhaltung Reseller/Amazon", „KSK Rechner").
3. Bestes bisheriges Content-Format identifizieren und gezielt wiederholen.

**Akzeptanzkriterium:** Content-Output real verdoppelt vs. August, 2 neue SEO-Seiten live, Top-Format erkannt.

---

## Woche 3 — Community-Traktion [P1]

**Schritte:**
1. In 2–3 Nischen-Communities konstant hilfreich präsent (nicht werblich). GbR/Reseller/Freelancer-Foren + Reddit.
2. Ein „hilfreiches Freebie" mit `stackr-marketing` bauen (z. B. Checkliste „Buchhaltung als GbR" / „EÜR-Vorbereitung") als Lead-/Goodwill-Magnet — verlinkt auf Stackr.
3. Feedback aus Communities in eine Produkt-/Copy-Verbesserungsliste kippen.

**Akzeptanzkriterium:** Konstante, nicht-spammy Präsenz in ≥2 Communities. 1 Freebie live. Feedback-Liste existiert.

---

## Woche 4 — Konversion nachschärfen [P1]

**Schritte:**
1. Trial→Paid-Zahlen auswerten: Wo brechen Leute ab? Mit `stackr-marketing` die schwächste Stelle (Landing-Abschnitt / Trial-Mail) überarbeiten.
2. Erste echte Testimonials/Erfahrungsberichte einsammeln (von zufriedenen Web-Nutzern) — mit Erlaubnis für Social Proof.
3. Social Proof (echte Stimmen, keine erfundenen) auf Landing einbauen lassen.

**Akzeptanzkriterium:** Mindestens 1 schwache Funnel-Stelle verbessert, ≥1 echtes Testimonial eingeholt + eingebaut.

---

## Review-Punkte

**Review Mitte September:** Abos: ____ · Azubi-Output: ____ · Community-Reaktion: ____
**Review Ende September:** Abos: ____ (Ziel ~100) · bester Kanal Q3: ____ · Trial→Paid: ____ · **Kurskorrektur:** Q4 = Steuer-Saison beginnt → was für Peak verdoppeln?

---

## 2026-10-oktober.md

# Oktober 2026 — Skalieren

North Star: 300 bis 31.12. · **Monatsziel: ~165 kumuliert zahlend** (+65) · Fokus: Was funktioniert verdoppeln, Referral live, Kaufabsicht der beginnenden Steuer-Saison abgreifen.

> Bis hier ist klar, welche 1–2 Kanäle wirklich zahlende Nutzer bringen. Oktober ist kein Experimentier-, sondern ein Verstärker-Monat: Ressourcen auf die Gewinner.

---

## Woche 1 — Gewinner verdoppeln [P0]

**Schritte:**
1. Aus den Q3-Reviews den stärksten Kanal (z. B. SEO-Vergleichsseiten, LinkedIn, Bestands-Konversion) bestimmen und Zeit/Output dort verdoppeln.
2. Schwächste Kanäle bewusst zurückfahren (Zeit ist der Engpass).
3. Mit `stackr-marketing`/`stackr-social`: mehr vom nachweislich besten Format produzieren.

**Akzeptanzkriterium:** Klare Entscheidung dokumentiert, welcher Kanal verdoppelt und welcher pausiert wird. Output entsprechend verschoben.

---

## Woche 2 — Referral live [P1]

**Kontext:** Das Referral-System ist bereits angelegt (Code), offen war der Rechtstext. Zufriedene Nutzer sind der glaubwürdigste Kanal.

**Schritte:**
1. Referral-Rechtstext finalisieren (ggf. `agb-writer`-Agent) — offener Punkt aus dem Projektstand.
2. Referral-Flow testen (funktioniert Einladung → Belohnung sauber?).
3. Mit `stackr-marketing`: Referral-Ankündigung an Bestandsnutzer entwerfen (Entwurf, Versand nach Go).

**Akzeptanzkriterium:** Referral rechtlich sauber + technisch funktionsfähig live, Bestandsnutzer informiert (nach Freigabe).

---

## Woche 3 — Steuer-Saison-Content [P1]

**Kontext:** Zum Jahresende suchen Selbstständige aktiv nach Buchhaltungslösungen („2027 sauber starten", USt-Voranmeldung, EÜR-Vorbereitung).

**Schritte:**
1. Mit `stackr-marketing`: Landing-/Content-Angle „Jetzt umsteigen, 2027 stressfrei buchen".
2. Mit `stackr-social`: Content-Serie zu Jahresend-Buchhaltungs-Pains (allgemein + korrekt, kein Steuerrat-Versprechen).
3. SEO-Seiten zu saisonalen Keywords prüfen/ergänzen (EÜR, USt-Voranmeldung, Jahresabschluss-Vorbereitung).

**Akzeptanzkriterium:** Saisonaler Angle auf Landing + laufender Content, saisonale Keywords abgedeckt.

---

## Woche 4 — Paid-Test vorbereiten [P2]

**Kontext:** Erst jetzt (Landing konvertiert nachweislich) lohnt ein kleiner bezahlter Test — abhängig davon, ob die Rechts-Blocker (Whop-DPA/Anwalt) breite Werbung erlauben.

**Schritte:**
1. Prüfen: Ist die Landing-Conversion gut genug, dass Paid rechnet? Falls nein → organisch bleiben.
2. Falls ja + Rechtslage ok: kleines Testbudget definieren, mit `stackr-marketing` 2–3 Ad-Varianten für den stärksten Kanal entwerfen.
3. Klare Erfolgsschwelle (CAC < X) festlegen, bevor Geld fließt.

**Akzeptanzkriterium:** Go/No-Go-Entscheidung für Paid dokumentiert mit Begründung. Falls Go: Test klein, messbar, mit Abbruchschwelle.

---

## Review-Punkte

**Review Mitte Oktober:** Abos: ____ · verdoppelter Kanal liefert? ____ · Referral live? ____
**Review Ende Oktober:** Abos: ____ (Ziel ~165) · Referral-Beiträge: ____ · Paid Go/No-Go: ____ · **Kurskorrektur** für den Nov/Dez-Peak.

---

## 2026-11-november.md

# November 2026 — Peak-Push

North Star: 300 bis 31.12. · **Monatsziel: ~235 kumuliert zahlend** (+70) · Fokus: stärkste Kaufphase des Jahres voll abgreifen (Jahresende-Steuer-Saison), alle Gewinner-Kanäle auf Anschlag.

> November + Dezember sind die Ernte. Selbstständige entscheiden jetzt, mit welchem Tool sie 2027 buchen. Maximale Präsenz auf den bewährten Kanälen, klares Jahreswechsel-Angebot.

---

## Woche 1 — Jahreswechsel-Angebot [P0]

**Kontext:** Ein konkreter Anlass + leichter Anreiz beschleunigt die Entscheidung — ohne das Preismodell zu beschädigen.

**Schritte:**
1. Mit `stackr-marketing`: Angebots-Angle „Starte sauber ins Steuerjahr 2027" — Jahres-Abo (135 €) prominent, evtl. zeitlich begrenzter, ehrlicher Anreiz (kein Dauerrabatt, der die Marke entwertet).
2. Angebot auf Landing + als E-Mail an Bestandsnutzer/Trial-Abbrecher (Entwurf, Versand nach Go).
3. Prüfen, dass Whop-Jahres-Plan-Link sauber funktioniert (offener Punkt aus Projektstand — vorab testen!).

**Akzeptanzkriterium:** Klares, ehrliches Jahreswechsel-Angebot live auf Landing + als Mail-Entwurf. Whop-Jahres-Checkout verifiziert funktionsfähig.

---

## Woche 2 — Reichweite auf Anschlag [P1]

**Schritte:**
1. Content-Frequenz auf Maximum, das Qualität hält (Azubi + `stackr-social`): tägliche Präsenz auf dem stärksten Kanal.
2. Founder-LinkedIn: 1–2 stärkere „Baue Stackr in Öffentlichkeit"-Posts (Zahlen/Meilensteine, sofern belegbar) für Reichweite.
3. Falls Paid getestet + positiv (Okt): Budget auf dem Gewinner-Kanal maßvoll erhöhen, CAC weiter überwachen.

**Akzeptanzkriterium:** Maximale tragfähige Content-Frequenz erreicht, Reichweiten-Zahlen steigen, Paid (falls aktiv) bleibt unter CAC-Schwelle.

---

## Woche 3 — Konversion einsammeln [P1]

**Schritte:**
1. Alle warmen Kontakte reaktivieren: Trial-Abbrecher, Offline-Nutzer, die noch nicht konvertiert sind — mit `stackr-marketing` gezielte Reaktivierungs-Mail (Winback ist bereits gebaut).
2. Landing-Conversion final optimieren: schwächster Abschnitt raus, stärkstes Testimonial nach oben.
3. Häufigste Kauf-Einwände aus Communities/Support in eine FAQ-Erweiterung gießen.

**Akzeptanzkriterium:** Winback/Reaktivierung an alle warmen Segmente raus (nach Go), Landing-FAQ deckt die Top-Einwände.

---

## Woche 4 — Auffüllen zum Ziel [P1]

**Schritte:**
1. Lücke zum Jahresziel berechnen (Ist vs. 300) und die 1–2 wirksamsten Hebel gezielt nochmal anstoßen.
2. Dezember-Sprint vorbereiten (Content vorproduzieren, damit über die Feiertage konstant gepostet wird).

**Akzeptanzkriterium:** Klare Zahl „noch X bis 300", Dezember-Content vorproduziert.

---

## Review-Punkte

**Review Mitte November:** Abos: ____ · Jahresangebot-Reaktion: ____ · Whop-Jahres-Link ok? ____
**Review Ende November:** Abos: ____ (Ziel ~235) · Lücke zu 300: ____ · bester Peak-Kanal: ____ · **Dezember-Plan:** genau die Hebel, die im Nov am meisten brachten.

---

## 2026-12-dezember.md

# Dezember 2026 — Jahresend-Sprint

North Star: **300 zahlende Abos bis 31.12.2026** · **Monatsziel: 300 kumuliert** (+65) · Fokus: die letzte Lücke schließen, Jahreswechsel-Kaufabsicht maximal nutzen, sauber ins nächste Jahr übergeben.

> Letzter Monat. Der Markt ist jetzt am kaufbereitesten (2027-Steuerjahr-Start). Konstante Präsenz trotz Feiertagen (vorproduziert), klarer Abschluss-Push, dann ehrliche Bestandsaufnahme.

---

## Woche 1 — Endspurt-Angebot [P0]

**Schritte:**
1. „Letzte Chance, sauber ins Steuerjahr 2027 zu starten"-Push (Landing + Mail an alle warmen Segmente), mit `stackr-marketing`.
2. Jahres-Abo (135 €) als naheliegende Wahl für Jahresstarter betonen — Ersparnis + „einmal einrichten, ganzes Jahr Ruhe".
3. Vorproduzierten Feiertags-Content konstant ausspielen (Azubi + `stackr-social`).

**Akzeptanzkriterium:** Endspurt-Botschaft live auf allen Gewinner-Kanälen, Content läuft trotz Feiertagen durch.

---

## Woche 2 — Warme Kontakte final [P0]

**Schritte:**
1. Jeden verbliebenen warmen Kontakt (Trial-Abbrecher, unkonvertierte Offline-Nutzer) ein letztes Mal ehrlich anstoßen.
2. Persönlicher Founder-Touch auf LinkedIn: Jahresrückblick „So ist Stackr 2026 gewachsen" (nur belegbare Zahlen) — baut Vertrauen + Reichweite.

**Akzeptanzkriterium:** Alle warmen Segmente final kontaktiert (nach Go), Jahresrückblick-Post veröffentlicht.

---

## Woche 3 — Lücke schließen [P1]

**Schritte:**
1. Exakte Rest-Lücke zu 300 berechnen. Die 1–2 Kanäle mit der besten Conversion-Rate gezielt nochmal maximal bespielen.
2. Reibungslosen Checkout sicherstellen (Whop Monats-+Jahres-Link, Trial→Paid) — nichts soll jetzt an einem technischen Hänger scheitern.

**Akzeptanzkriterium:** Rest-Lücke benannt + gezielt bearbeitet, Checkout-Pfade verifiziert fehlerfrei.

---

## Woche 4 — Ziel-Check + Übergabe ins neue Jahr [P1]

**Schritte:**
1. Endstand messen: zahlende Abos vs. 300. Ehrliche Bilanz — erreicht / knapp / verfehlt und **warum**.
2. Was hat über 6 Monate am meisten gebracht? → als „Playbook 2027" festhalten (welche 2–3 Kanäle skaliert werden).
3. Offene Blocker (Whop-DPA/Anwalt-Freigabe) für Q1 2027 als Prio notieren, falls noch offen.
4. Neuen Plan-Zyklus (Jan–Jun 2027) mit den echten Zahlen dieses Jahres aufsetzen — nicht mehr mit Annahmen.

**Akzeptanzkriterium:** Endstand dokumentiert mit Ursachenanalyse, „Playbook 2027" (Top-Kanäle) steht, Übergang zum nächsten Plan-Zyklus vorbereitet.

---

## Review-Punkte

**Review Mitte Dezember:** Abos: ____ · Lücke zu 300: ____ · Endspurt-Reaktion: ____
**Jahres-Abschluss-Review (31.12.):**
- **Endstand zahlende Abos: ____ / Ziel 300**
- Größter Wachstumstreiber 2026: ____
- Größte Fehlannahme (was hat nicht funktioniert): ____
- Playbook 2027 (Top 2–3 Kanäle zum Skalieren): ____
- Offene Blocker für Q1 2027: ____

---

## README.md

# Stackr — Wachstumsplan Jul–Dez 2026

> Erstellt 2026-07-05. Ziel-Asset: einmal strategisch durchdacht, danach Woche für Woche mit günstigeren Modellen abarbeitbar. Jedes Wochen-Item ist ein fertiger Arbeitsauftrag mit Kontext + Akzeptanzkriterien — ein schwächeres Modell (oder du) kann es direkt ausführen.

## North Star

**300 zahlende Web-Abonnenten bis 31.12.2026.**

Bei 15 €/Monat ≈ **4.500 € MRR** bzw. mit Jahres-Anteil grob 4.000–4.500 € MRR. Der Weg dahin ist kein Kaltstart: Stackr hat bereits **viele aktive Nutzer der kostenlosen Offline-Version** — das ist die wertvollste, am günstigsten zu konvertierende Zielgruppe. Der Plan baut darauf auf und ergänzt planbare organische Kanäle.

## Ausgangslage (Fakten, Stand Juli 2026)

- **Produkt:** Stackr Web (Buchhaltung DE/CH), Web-Pro 15 €/M bzw. 135 €/J über Whop (7-Tage-Trial). Kostenlose Offline-Version (Local) = Gratis-Funnel.
- **USPs:** Offline-First (Daten bleiben beim Nutzer), Lager + Fahrtenbuch + KSK + AfA integriert, GbR-Support, DE/CH in einem Tool, Akademie/Gamification, Dark Mode, optionaler E2E-Cloud-Sync.
- **Team:** Solo-Gründer, begrenzte Zeit. **Ab September 2026 Azubi (Bankkaufmann)** → mehr Ausführungskapazität in Q4.
- **Offene Blocker (nicht Marketing, aber launch-relevant):** Whop-DPA / finale Anwalt-Freigabe für Rechtstexte stehen aus. Echte Whop-Plan-Links + Referral-Rechtstext teils offen.

## Strategie — worauf wir setzen (und was wir lassen)

Priorisiert nach ROI für einen zeitarmen Solo-Gründer (Research 2026: organische CAC ~⅓ von paid; SEO + Founder-LinkedIn + E-Mail führen):

1. **Bestandskonversion (höchster ROI):** Offline-Nutzer → Web-Abo. Owned Audience, kein CAC. In-App-Hinweis + E-Mail (falls Adressen vorhanden) + klarer Web-Mehrwert (Cloud-Sync, überall zugreifen).
2. **SEO mit Kaufabsicht:** Vergleichsseiten („Stackr vs. sevDesk/lexoffice"), Nischen-Long-Tail („Buchhaltung GbR", „Buchhaltung offline", „Buchhaltung Schweiz Freelancer"), Use-Case-/Tutorial-Content. **Kein** generischer „Was ist EÜR"-Content (beantwortet die KI). Compounding, günstig.
3. **Founder-LinkedIn:** Persönliches Profil (5–10× Reichweite von Firmenseiten), 2–3 Posts/Woche: ehrliche Gründer-Perspektive, Buchhaltungs-Pains der Zielgruppe, Contrarian Takes.
4. **Kurzvideo (TikTok/Instagram Reels):** Reichweite bei jungen Selbstständigen. Buchhaltungs-Pain in 15–30 s + konkreter Aha-Moment.
5. **Nischen-Communities:** Reddit (r/Finanzen, r/selbststaendig), Selbstständigen-/GbR-/Reseller-Facebook-Gruppen — ehrlich helfen, nicht spammen.

**Bewusst NICHT jetzt:** teure Paid Ads im großen Stil (erst wenn eine Landing nachweislich konvertiert), Kooperationen mit hohem Vorlauf, breite PR.

## Kanal-Werkzeuge (bereits gebaut)

- Agent **`stackr-marketing`** → Landing-Copy, Ads, E-Mail, Kampagnen. Strenger Claims-Guardrail (keine erfundenen Zahlen, keine Steuerberatungs-Versprechen, nichts wird ohne Go veröffentlicht).
- Agent **`stackr-social`** → Instagram/TikTok/LinkedIn-Content (Hooks, Skripte, Carousels, Captions).

Wochen-Items verweisen auf diese Agents, damit günstigere Modelle sie ausführen können.

## Monats-Meilensteine (Ramp)

| Monat | Meilenstein | Kumuliertes Ziel (zahlend)* |
|-------|-------------|------------------------------|
| Juli | Fundament: Offline→Web-Funnel scharf, SEO-Skelett, Founder-Kanäle live | ~20 |
| August | Konversions-Welle Bestandsnutzer + erste SEO-Vergleichsseiten ranken | ~55 |
| September | Content-Maschine läuft (Azubi onboarded), erste Community-Traktion | ~100 |
| Oktober | Skalieren: was funktioniert verdoppeln, Referral live | ~165 |
| November | Peak-Push (Jahresende-Steuer-Saison beginnt) + ggf. erstes Paid-Testbudget | ~235 |
| Dezember | Jahresend-Sprint: „Für 2027 sauber aufgestellt"-Angebot | **300** |

*Ziel-Zahlen sind **Annahmen** (kein historischer Conversion-Beleg vorhanden). Bei den Review-Punkten gegen echte Zahlen ersetzen und die Ramp anpassen. Siehe [Annahmen & Entscheidungen](#annahmen--entscheidungen).

## Wie man diesen Plan abarbeitet

1. Am Monatsanfang die Monatsdatei öffnen (`2026-MM-*.md`).
2. Wochen-Items der Reihe nach abarbeiten — jedes hat Kontext, Schritte, Akzeptanzkriterien.
3. Für Copy/Content den passenden Agent aufrufen (`stackr-marketing` / `stackr-social`).
4. Alle 2 Wochen den Review-Block ausfüllen: Zahlen eintragen, Kurs korrigieren.

## Annahmen & Entscheidungen

- **~10–15 h/Woche** Gründer-Zeit angenommen (bis Azubi-Start Sept). Falls real weniger: pro Monat nur die mit **[P0]** markierten Items machen. **← Kalibrier-Knopf, an echte Kapazität anpassen.**
- **Kein Marketing-Budget** vorausgesetzt bis November; Plan ist organisch. Paid erst nach Landing-Conversion-Beleg.
- **300 als Jahresziel** ist ambitioniert für Solo-organisch; der Hebel, der es trägt, ist die Bestandskonversion. Wenn die Offline-Basis kleiner/kälter ist als gedacht, ist 150–200 realistischer → früh im Juli messen (Woche 1).
- Steuer-Saisonalität: Q4/Jahreswechsel ist die stärkste Kaufphase für Buchhaltungssoftware → Peak-Push in Nov/Dez eingeplant.
- Rechts-Blocker (Whop-DPA/Anwalt) können großflächige Werbung bremsen → Plan hält bezahlte Reichweite bis zur Freigabe klein.

## Erfolgsmessung (jeden Review)

- Kumuliert zahlende Abos (North-Star-Fortschritt)
- Trial-Starts → Trial→Paid-Conversion
- Offline→Web-Klicks (falls messbar)
- Organischer Traffic + Top-Ranking-Keywords
- Bester/schlechtester Kanal des Zeitraums → Budget/Zeit umschichten

## Monatsdateien

- [Juli 2026 — Fundament](2026-07-juli.md)
- [August 2026 — Konversions-Welle](2026-08-august.md)
- [September 2026 — Content-Maschine](2026-09-september.md)
- [Oktober 2026 — Skalieren](2026-10-oktober.md)
- [November 2026 — Peak-Push](2026-11-november.md)
- [Dezember 2026 — Jahresend-Sprint](2026-12-dezember.md)

---

