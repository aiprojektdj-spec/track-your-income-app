# Technische Sanierung Stackr Web 1.7 — Abschlussbericht

**Datum:** 2026-08-09
**Umfang:** Vollständige technische Sanierung nach ~60-Punkte-Prompt (Security, Steuerlogik, Rechnungen/XRechnung, GoBD/Datenintegrität, Verbraucherrecht/AGB, Datenschutz, Qualität/A11y)
**Ergebnis:** 38 Dateien geändert, 14 Testdateien / 200+ Einzeltests (alle grün), `node --check` über gesamtes `js/`/`api/`/`rechnungen/js/` sauber

**Rahmenbedingungen dieser Session** (relevant für Anschlussarbeit):
- Monatliches Claude-Ausgabenlimit wurde mitten in parallelen Hintergrund-Agents erreicht — 2 von 5 Agents brachen ab, wurden manuell nachvollzogen und fertiggestellt (Diffs geprüft, keine Halbzustände übernommen).
- Zwei weitere Sessions liefen währenddessen live im selben Repo (`plan/OFFEN.md`-Pflege, `Local sync Punkte 16-21`). Kollisionen wurden durch `git status`-Checks vor jeder Datei vermieden. Von diesen Sessions verändert (nicht Teil dieses Berichts): `impressum.html`, `plan/PLAN.md`, `plan/OFFEN.md`, `plan/abschluss-local-sync-16-21-2026-08-09.md`, Verschiebung aller `test-*.js` von Repo-Root nach `test/`.

---

## Phase 1 — Bestandsaufnahme & Befundmatrix

Sechs parallele Research-Agents haben Architektur, Datenmodell, Whop-Flow, Vercel Blob, Redis, Cloud-Sync, Backup, Audit-Log und alle Steuermodule gegen den aktuellen Code geprüft (nicht gegen den Prompt-Text blind vertraut). Ergebnis: fast alle ~60 Punkte am aktuellen Code bestätigt, einige bereits durch frühere Sessions behoben vorgefunden (z. B. Teile der §25a-Logik), diese wurden als "bereits erledigt" markiert statt erneut bearbeitet.

---

## Phase 2 — P0 Security (Punkte 1–7) ✅ abgeschlossen

| # | Befund | Fix |
|---|---|---|
| 1 | `api/blob-upload.js` `commit`/`delete` akzeptierten fremde Blob-URLs ohne Eigentumsprüfung | Ownership-Check: URL-Pfad muss exakt zu `stackr/<kind>/<userId>/<scope>/` des authentifizierten Nutzers gehören (neue Funktion `isOwnedBlobUrl`) |
| 2 | Kein Deckel gegen Blob-DoS (4000 Chunks erlaubt, kein Concurrency-Schutz) | `MAX_CHUNKS_PER_COMMIT` realistisch auf ~58 (200MB/4MB+Marge) reduziert, Redis-basierter Concurrency-Lock pro Nutzer (`blob:commitlock:<userId>`, TTL 30s) |
| 3 | `eigenbelege/js/app.js`: JSON-Import übernahm ungeprüfte `id`-Werte, Druckfenster schrieb `b.id` ungeescaped via `document.write()` in `<title>` | Strikte ID-Whitelist-Regex beim Import (`_safeImportId`), `esc()` an allen 6 Fundstellen ergänzt |
| 4 | Systematischer XSS-Sweep über Import-/Sync-/Rechnungs-/CSV-/JSON-/Druckpfade | Nur Eigenbelege betroffen (Fund 3); Rechnungen/E-Rechnung-Import/Fahrtenbuch bereits konsequent escaped |
| 5 | Lokale Unternehmensdaten nicht an Whop-User-ID gebunden — nach Logout blieben Daten für nächsten Account im selben Browser sichtbar | Neue Geräte-Sperre (`js/whop-auth.js`): `oyi_device_owner_uid`-Marker, bei Mismatch Blockbildschirm mit Logout- oder (mehrfach bestätigtem) Geräte-Reset-Button — keine automatische Datenvernichtung |
| 6 | OAuth-Token, AES-Schlüssel, StB-ECDH-Private-Key im Klartext in localStorage | StB-ECDH-Private-Key für NEUE Accounts jetzt `extractable:false`, gespeichert als CryptoKey-Objekt in eigener IndexedDB (`js/stb-share.js`); Whop-Token/Sync-Key bleiben aus Architekturgründen in localStorage (volle BFF-Session-Migration wäre eigenes Projekt) |
| 7 | AES-GCM ohne AAD-Bindung an userId/Scope/Version | AAD = `ownerId|scope|sync-v1` in `js/cloud-sync.js` + `js/backup-crypto.js`, mit Migrations-Fallback (Decrypt versucht erst mit AAD, dann ohne — für Altdaten) |

---

## Phase 3 — P0 Steuerlogik (Punkte 8–25) ✅ abgeschlossen (24/25, 1 bewusst nur teilkorrigiert)

| # | Thema | Kernfix |
|---|---|---|
| 8 | Ausgaben ohne USt-Satz | Pflichtfeld `ustSatz` (19\|7\|0\|'rc'\|'unklar') in `js/ausgaben.js`; Altbestand ohne Feld gilt als 'unklar', nie automatisch 19% |
| 9 | EÜR pauschal 19% USt aus Versand/Plattform/Fahrt/Material | `js/euer.js`: `vstOther=0` statt Pauschale, `vstExpenses` nutzt jetzt echten `ustSatz` je Position |
| 10 | GewSt-Freibetrag griff nie (`gewStFreibetrag === true` statt numerischer Vergleich) | `js/gewerbesteuer.js`: `> 0` — betraf JEDEN Einzelunternehmer/GbR, GewSt war bis zu 2,6× zu hoch |
| 11 | §35-EStG-Anrechnung Faktor 3,8 statt 4,0, keine Deckelung | Faktor 4,0 + `Math.min(messbetrag*4, gewSt)` in `gewerbesteuer.js` + `euer.js`-Duplikatrechner |
| 12 | Vereinnahmte USt komplett aus EÜR entfernt | Fachlich neutral belassen (Netto-Verfahren korrekt für Jahresgewinn), Fix 3 (Vorsteuer-Pauschale) behoben |
| 13/14 | Soll-Periodisierung nach Rechnungsdatum statt Leistungsdatum (13, nicht vollständig lösbar ohne neues Datenfeld); Ist-UVA verlor Aufteilung bei gemischten 7%/19%-Rechnungen (14) | `js/store.js` `createSaleFromInvoice`: `sale.steuersaetze`-Breakdown pro Satz statt Single-Value; `js/ustvoranmeldung.js` `_perRateGroups()` summiert satzgenau — auch bei Teil-/Schlusszahlungen |
| 15/16 | Lohnsteuer kein echtes PAP-Verfahren, SV-Werte 2025 statt 2026 | BBG/Sätze auf 2026 aktualisiert (BMAS-Verordnung), Soli-Freigrenzenprüfung (§3 SolzG) neu implementiert, Warnbanner "keine amtliche Berechnung" verstärkt |
| 17 | KSK: 2026-BBG war Kopie von 2025, kein Kinderlosenzuschlag | BBG korrigiert, `hatKinder`-Feld + PV-Zuschlag 0,6% |
| 18/19 | §19-Schwellen `>=` statt `>`, keine historische Differenzierung; Akademie lehrte 22.000/50.000€ | `_getUstGrenzen(year)` in `js/app.js` (25.000/100.000 ab 2025, 22.000/50.000 2020-2024, 17.500/50.000 davor), Akademie-Texte + Achievement-Schwelle synchronisiert |
| 20 | AfA degressiv→linear verglich zeitanteilige degressive AfA mit VOLLER linearer Jahres-AfA | `js/afa.js`: linearer Vergleichswert im Anschaffungsjahr jetzt ebenfalls monatsanteilig |
| 21 | §25a: Gutschriften/Retouren hoben Marge nicht auf, Sammelverkäufe nur 1. Einkaufs-ID | `js/ustvoranmeldung.js`: `margeKorrektur`-Feld statt erneutem vk-ek-Clamp, Retouren-Pfad für §25a ergänzt, `_sumEk25a()` summiert alle `purchaseIds` |
| 22 | KSt: UG-Rücklage aus zvE vor Steuern statt Jahresüberschuss nach Steuern | `js/koerperschaftsteuer.js`: `jahresueberschussNachSteuern = fin.gewinn - calc.steuerGesamt`, Pflichthinweis "keine bilanzielle Gewinnermittlung" ergänzt |
| 23 | GbR: keine Sonderbetriebseinnahmen/-ausgaben | `js/gbr.js`/`gbr-modul.js`: neues SBE/SBA-Erfassungsfeld je Gesellschafter, additiv zum Gesamthandsgewinn-Anteil |
| 24 | Fahrtenbuch: km-Stand optional, keine Lückenlosigkeits-Prüfung | `js/fahrtenbuch.js`: km-Stand Pflichtfeld, Konsistenz-Check ggü. Streckenlänge + letzter Fahrt desselben Fahrzeugs (Warnung, nicht blockierend) |
| 25 | Kassenbuch: kein Jahresanfangsbestand-Rollover, keine Audit-Protokollierung bei Erstellung/Änderung | `js/kassenbuch.js`: `_anfangsbestandFuerJahr()` aus Vorjahresbuchungen abgeleitet; `js/store.js` `saveKassenEintrag()` protokolliert jetzt erstellt/bearbeitet |

---

## Phase 4 — Rechnungen/XRechnung (Punkte 26–32) ✅ abgeschlossen

- **26** Rundung: Zeilenbeträge werden jetzt zuerst gerundet, dann summiert (EN 16931 BR-CO-10) — vorher Differenz zwischen Kopf- und Zeilensumme möglich.
- **27** `pos.menge || 1` änderte eine bewusste Menge 0 stillschweigend zu 1 — an allen 4 Fundstellen (`xrechnung.js`, `rechnung.js` ×2, `wiederkehrend.js`) auf explizite `null`-Prüfung umgestellt.
- **28** Kunden-USt-ID wurde als `ustIdNr` gespeichert, aber im XRechnung-Export als `kunde.ustId` gelesen (falscher Feldname) — korrigiert.
- **29/30** Steuerkategorien: `taxCategoryFor()` unterscheidet jetzt Kleinunternehmer (E), ig. Lieferung/Ware (K, §6a), Reverse Charge/Leistung (AE, §13b), Ausfuhr (G, §6) statt pauschal §13b-Text für alles mit 0%. Rechnungstext (`rechnung.js`) zeigt getrennte §6a-/§13b-Absätze je nach `pos.igArt`.
- **31** §14-Pflichtfeld-Gate lief nur für `typ==='rechnung'` — jetzt auch für Gutschriften; wiederkehrende Rechnungen (`wiederkehrend.js`) hatten gar keinen Gate — jetzt Pflichtfeld-Check vor Generierung, überspringt bei fehlenden Angaben statt unvollständig zu erstellen. `XRechnung.download()` validiert zusätzlich vor Export (`validatePflichtfelder()`).
- **32** Kein KoSIT-Validator integriert (technisch außerhalb des Sessionsrahmens) — Badge-Text in `erechnung-import.js` von "Gültige E-Rechnung (EN 16931)" auf "Pflichtfelder vorhanden (keine KoSIT-Validierung)" korrigiert, um keine falsche Konformitätsaussage zu suggerieren.

---

## Phase 5 — GoBD/Datenintegrität (Punkte 33–40)

**Behoben:**
- **33** Marketing-Überclaim "lückenloses GoBD-konformes Protokoll" auf "unterstützt GoBD-konformes Arbeiten" abgeschwächt (`index.html` ×3, `stackr-broschuere.html`).
- **35** **Schwerster Einzelfund der ganzen Sanierung:** `Store.saveRechInvoice()` bestimmte "neu" anhand von `!invoice.id` — der Aufrufer vergibt die ID aber immer schon vor dem Speichern, wodurch der komplette "erstellt"-Audit-Zweig (+ Webhook-Feuerung) für JEDE neu erstellte Rechnung/jedes Angebot/jede Gutschrift nie erreicht wurde. Fix: "neu" wird jetzt anhand des persistierten Bestands (`idx<0`) bestimmt.
- **37** Mehrtab-Race bei Rechnungsnummern: `nextRechInvoiceNumber()` las den Counter aus dem tab-lokalen In-Memory-Cache statt frisch aus IndexedDB — trotz `navigator.locks`-Schutz konnten zwei Tabs dieselbe Nummer ziehen. Neuer `_idbGetAsync()`-Helper erzwingt frischen Read innerhalb des Locks.
- **38** Restore (`backup-crypto.js`): IDB-Schreibfehler wurden verschluckt (`.catch(()=>{})`), "✅ Daten importiert" erschien auch bei Teilfehler. Jetzt `Promise.allSettled` + Fehlerliste, `doImport()` zeigt betroffene Keys statt Pauschal-Erfolg.
- **39** Cloud-Merge konnte physisch gelöschte offene Buchungen durch einen älteren Snapshot eines anderen Geräts wiederbeleben. Neuer Tombstone-Mechanismus (`Store.getTombstones()`/`_addTombstone()`/`isTombstoned()`, synct automatisch im `reselling_`-Präfix mit) verhindert das in `cloud-sync.js` `_mergeRecords()`.
- **40** `deleteRemote()`/`BlobAttachments.deleteUrls()` ignorierten HTTP-Fehler beim Löschen, meldeten trotzdem Erfolg. Jetzt Statusprüfung + Retry-Queue (`oyi_sync_pending_deletions`, wird bei jedem Sync automatisch abgearbeitet).

**Bewusst zurückgestellt** (Rationale: zu invasiv/riskant für einen Rush-Fix ohne dedizierte Testumgebung):
- **34** Audit-Log-Hash bleibt schwacher Rolling-Hash (kein SHA-256) — ein Wechsel würde alle bestehenden Nutzer-Audit-Ketten brechen, bräuchte versionierte Migration + async-Umbau (crypto.subtle.digest ist async, `_addAuditEntry` wird an Dutzenden Stellen synchron aufgerufen).
- **36/38 (vollständig)** Echte Multi-Key-Transaktionsatomarität über Rechnung+Zahlung+Verkauf+Lager+Audit+Webhook hinweg sowie vollständiges Staging+Readback beim Restore — bräuchten eigene Session mit dediziertem Test-Setup (IndexedDB-Transaktionsverhalten über mehrere Keys ist im aktuellen Key-Value-Store-Design nicht trivial atomar).

---

## Phase 6 — Verbraucherrecht/AGB (Punkte 41–50)

**Live-Whop-Checkout geprüft** (nur lesend, `https://whop.com/checkout/plan_iR6YIKLcychSZ`):
- Gesamtpreis (15,00€) + Startdatum vor Bestellung sichtbar ✅
- Bestellbutton heißt **„Beitreten"** — nicht eindeutig als zahlungspflichtig erkennbar (§312j Abs. 3 BGB). **Extern**: Whop-Plattformtext, von Stackr nicht änderbar.
- Checkoutseite verweist auf „Stackr's AGB", verlinkt aber nur zu `whop.com/tos` (Whop-AGB) — Stackrs eigene AGB auf der Checkoutseite nicht erreichbar.
- Land-Voreinstellung stand auf „Netherlands" (vermutlich IP-Artefakt des Tests, zu beobachten).

**Code-Abgleich:**
- `agb.html` hat bereits einen §6-Widerrufsabsatz + Verweis auf `refund.html` — aber kein §356a-„Vertrag widerrufen"-Button-Äquivalent (seit 19.06.2026 Pflicht), Kündigung verweist nur auf "dein Whop-Konto" (laut Vorgabe reicht das für §312k nicht aus). **Extern**: Stackr hat keine eigene Account-Verwaltung, Kündigung läuft zwingend über Whop.
- **49 behoben:** `stackr-broschuere.html`/`stackr-onepager.html` beschreiben ein komplett anderes Produkt/Preismodell (45€ einmalig, WhatsApp+PayPal, "kein Abo" = "Stackr Local"). Fund: **kein totes Altertum** — `build-deploy.py` (Commit vor 1 Monat) baut diese Dateien aktiv zu einer portablen Einzeldatei für den WhatsApp-Vertrieb. Auf Nutzerentscheidung: Quelldateien + Build-Skript bleiben erhalten, aber `vercel.json` redirected `/stackr-broschuere.html` und `/stackr-onepager.html` jetzt von der Live-Hauptdomain auf `/` — die Seiten sind auf `track-your-income-app.vercel.app` nicht mehr direkt aufrufbar.
- **50 offen:** Testimonials in `landing-v2.html` (Max K./Sara L./Tom M.) wirken wie unbelegte Platzhalter ohne Erhebungsdatum/Quelle — Echtheit von mir nicht verifizierbar, User muss intern klären.
- **§312j/k/356a-Klauseltexte, AGB-Überarbeitung (§46/§47):** bewusst NICHT selbst verfasst — braucht `agb-writer`/`legal-reviewer`-Agent + anwaltliche Freigabe (Haftungsrisiko bei eigenmächtiger Rechtstext-Formulierung).

---

## Phase 7 — Datenschutz (Punkte 51–56) ✅ abgeschlossen

- **51/52** `datenschutz.html` um neue Abschnitte 4.2 (Make.com-Webhooks: Klartext-Übertragung, Nutzer wird bei Aktivierung selbst datenschutzrechtlich Verantwortlicher) und 4.3 (StB-Freigabe: Public Key, Grant, IP-Rate-Limit) ergänzt.
- **53** Vercel Analytics: **entkräftet**, kein `@vercel/analytics` im Code, `cookies.html` verneint bereits korrekt.
- **54** AVV-Text von "wird geschlossen" (Faktum) auf "ist vorgesehen bzw. wird über die Standard-AVV der Anbieter abgedeckt" korrigiert — Status war laut internem Dossier nie schriftlich bestätigt.
- **55** Cookie-Inventar: neue Kategorie "Funktional" (Bedienkomfort, `.badge-functional` in `css/legal.css`) von "Notwendig" getrennt für reine UI-Präferenz-Keys (`lager_layout` etc.), Legende in `cookies.html` ergänzt.
- **56** Pauschale "10 Jahre"-Aussage über 6 Fundstellen (`datenschutz.html`, `js/akademie.js` ×2, `js/app.js` ×2, `eigenbelege/js/app.js` ×2) auf § 147 AO differenziert: Rechnungen/Buchungsbelege 8 Jahre, Bücher/Aufzeichnungen/Jahresabschlüsse 10 Jahre.

---

## Phase 8 — Qualität/Offline/A11y (Punkte 57–61)

- **57** 14 neue Testdateien decken jetzt UStVA, Vorsteuer, EÜR/GewSt, §19, §25a (indirekt über UVA-Tests), AfA, Lohnsteuer/KSK, XRechnung, Kassenbuch, KSt/GbR ab (200+ Assertions gegen den ECHTEN Code per Quelltext-Extraktion, nicht nachgebaute Kopien).
- **58** Staging-Tests für CAS-Konflikte/Blob-Ownership/Mehrgeräte-Merge gegen echte Upstash/Vercel-Infrastruktur: **nicht umsetzbar** ohne Zugriff auf echte Staging-Credentials — außerhalb des Sessionsrahmens.
- **59** "App funktioniert vollständig offline"-Claim in `index.html` korrigiert: kein Service Worker vorhanden, Text jetzt präzisiert (Dateneingabe offline möglich NACH erstmaligem Laden, nicht Kaltstart ohne Netz).
- **60** Cache-Versionierung/Performance/Observability: nicht angefasst (Größerer Scope, kein akuter Fehler gefunden — nur potenzielles Verbesserungspotential).
- **61** Modal (`js/app.js` `showModal`/`closeModal`): `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modalTitle"` ergänzt; Fokus kehrt beim Schließen zum auslösenden Element zurück (WCAG 2.4.3). Nicht live im Browser verifiziert (kein Whop-Login in dieser Session, s. Projektregel).

---

## Phase 9 — Verifikation

- `node --check` über `js/*.js`, `api/*.js`, `eigenbelege/js/*.js`, `rechnungen/js/*.js`, `lager/*.js`: **keine Syntaxfehler**.
- `npm audit --omit=dev`: **1 moderate Schwachstelle** (`undici` ≤6.27.0, transitiv über `@vercel/blob@2.6.1`, `npm audit fix` löst sie nicht — der Pin sitzt in `@vercel/blob` selbst, wartet auf Upstream-Update).
- Alle 14 Testdateien: **200+/200+ bestanden**.
- Finaler `git status`/`git diff`-Abgleich: keine fremden Änderungen (anderer Sessions) überschrieben oder verloren.

---

## Empfehlung für die nächsten Schritte

1. **Kurzfristig, ohne Code:** AVV mit Vercel/Upstash tatsächlich abschließen; Whop-Checkout-Button-Wortlaut bei Whop-Support ansprechen; Testimonials verifizieren oder entfernen.
2. **Nächste Session, mit `agb-writer`/`legal-reviewer`:** §312j/k/356a-konforme AGB/Widerrufsklauseln entwerfen, dann Anwalt gegenlesen lassen.
3. **Eigene, dedizierte Session:** Audit-Log-Hash-Migration (SHA-256 + Versionierung), volle Transaktionsatomarität, Staging-Tests gegen echte Cloud-Infrastruktur.
4. **Vor jedem weiteren Zugriff auf dieses Repo:** `list_sessions` + `git status` prüfen — mehrere Sessions arbeiten hier regelmäßig parallel.
