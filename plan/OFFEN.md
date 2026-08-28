> ## ⚠ Abgelöst — Stand 2026-08-14
>
> Die Arbeitsliste ist nach [`01-AUFGABEN.md`](01-AUFGABEN.md) umgezogen, die bewussten
> Nicht-Änderungen nach [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).
> Diese Datei bleibt als **Archiv** mit den ausführlichen Begründungen älterer Funde stehen.

---

# Stackr — was noch zu tun ist

**Stand 2026-08-09.** Diese Datei ist die *Status*-Liste. `PLAN.md` bleibt das Archiv mit den
ausformulierten Prompt-Texten — dort steht das *Wie*, hier das *Ob noch*.

> **Warum es diese Datei gibt:** `PLAN.md` entstand am 2026-07-27, indem rund 60 Einzeldateien
> wörtlich zusammenkopiert wurden — ohne Erledigt-Markierungen. Sein Inhaltsverzeichnis listet 23
> Prompts unter „Offene Session-Prompts", von denen nur einer als erledigt markiert ist. Nach
> Abgleich mit Code und Memory sind mindestens elf davon längst fertig. Wer `PLAN.md` als
> Arbeitsliste nimmt, arbeitet Erledigtes nach. Diese Datei löst das.

Angaben sind gekennzeichnet: **[geprüft]** = am Code verifiziert · **[Memory]** = aus
Projektgedächtnis übernommen, nicht neu verifiziert.

---

> ## ⛔ Local 1.7 wird nicht mehr gepflegt (Entscheidung 2026-08-11)
>
> Der Ordner bleibt liegen, wird aber **nicht mehr gespiegelt**. Alle Local-Punkte in dieser
> Datei sind damit hinfällig und unten durchgestrichen bzw. entfernt — sie brauchen keine
> Bearbeitung mehr.
>
> **Was bleibt:** der **Local-Import in Web 1.7** als Migrationspfad für Bestandskunden
> (`js/backup-crypto.js`, Firmen-Auswahl beim Import). Der muss funktionsfähig bleiben und
> weiter getestet werden — er ist ab jetzt der einzige Grund, warum Local überhaupt noch
> eine Rolle spielt.

## Kurzfassung: was noch offen ist (Stand 2026-08-11)

Code-seitig ohne Anwalt/User-Login ist alles abgearbeitet. Übrig bleibt:

1. **§25a 7%-Satz (2.1a)** — bewusst nicht angefasst, braucht juristische Recherche zu
   Anlage-2-Fällen, keine Coding-Aufgabe. Geringe Dringlichkeit.
2. ~~**Consent-Banner Local `app.html`**~~ — **entfällt**, Local wird nicht mehr gepflegt.
   `plan/session-prompt-local-consent-banner-2026-08-09.md` ist gegenstandslos.
3. **Anwalts-Freigabe** — AGB §11, §356-Trial-Klausel — wartet auf Antwort des Anwalts.
4. **Whop-DPA/AV-Vertrag** — wartet auf Whop.
5. **Vier Live-Tests, nur durch dich machbar** — Cloud-Sync 2-Profil-Test, Make.com-Webhook,
   StB-Zugang 2-Accounts, Lager-Feature Punkt 10 (s. Abschnitt 4).
6. **`ui-politur`** — hat sich erledigt: Der UI-Checker-Lauf vom 2026-08-11 hat die fehlende
   Fundliste geliefert (siehe 2.8).
7. **Vollaudit-Funde 2026-08-10/11** — Abschnitte 2.4 bis 2.9, laufend abgearbeitet.
   Sammelübersicht: [`funde-gesamt-2026-08-10.md`](funde-gesamt-2026-08-10.md).

Zusätzlich aktuell in Arbeit von einer anderen Session (nicht anfassen, s. Abschnitt 1):
`agb.html`, `js/whop-auth.js` (Web). Die Local-Dateien sind mit der Entscheidung oben
gegenstandslos.

---

## 1. Aktuell in Arbeit — nicht anfassen

| Wo | Was | Hinweis |
|---|---|---|
| Web, `agb.html`, `js/whop-auth.js` | uncommittet | Session "Sanierung 2026 Abschlussbericht" läuft **[geprüft, 2026-08-09 20:31]** |
| Web, Audit-Funde | laufend | Eine Session arbeitet die Vollaudit-Funde ab (R3/R5/R7/R8, T1/T3/T4/T5/T6, U1/U2 bereits committet) **[geprüft, 2026-08-11]** |
| ~~Local~~ | — | ⛔ Local wird nicht mehr gepflegt (Entscheidung 2026-08-11), Zuordnung hinfällig |

**Korrektur eines alten Eintrags:** „Local-Git verwaist" (frühere Memory-Notiz) stimmt nicht mehr —
`Local 1.7` hat inzwischen ein eigenes Git-Repo (`branch main`, aktuell 1 Commit vor `origin/main`,
u.a. `71342b9 AGB-§4: Datenspeicherung-Absatz an echte Architektur angepasst`, `95c43d4
Web-1.7-Sync: Steuer-Berechnung, §25a-Settings, GoBD/USt-Fixes, Companies-Härtung`). Wurde
irgendwann zwischen den Sessions eingerichtet, ohne dass Memory/diese Datei das nachgezogen haben.

**Vor jedem Arbeitsbeginn:** `git status` in beiden Ordnern und `list_sessions` prüfen. Dieses
Repo wird regelmäßig von mehreren Sessions parallel bearbeitet; am 2026-07-26 haben sich zwei
Sessions gegenseitig Dateien überschrieben, bis Dateien vorher zugewiesen wurden.

---

## 2. Offene Code-Arbeit

### 2.0b Firmen-Dubletten und Stück-Limit — ✅ erledigt 2026-08-24 (`f94c736`)

**Befund.** `oyi_companies` ist ein Array von Objekten mit `id`, `_isRecArr` sagt dazu `true` —
die Registry lief also über `_mergeRecords` als Union der IDs. Den Grabstein-Zweig dort schützt
`entityType`, und `_merge` setzte den nur für purchases/sales/expenses; für die Registry blieb er
`null`. Jede Remote-ID, die lokal fehlte, kam damit zurück.

Folge: `CompanyManager.delete()` räumte IDB, localStorage und über `deleteRemote()` den
Cloud-Snapshot der Firma — aber **nicht** ihren Eintrag im `__account`-Scope. Der nächste Sync
holte ihn zurück, und weil `_syncScope` für eine Firma ohne Remote-Snapshot neu pusht, entstand
ihr Scope gleich mit. Übrig blieb ein leerer Eintrag im Umschalter: **Löschen war wirkungslos.**

Zweitens band `MAX_COMPANIES = 5` nur `create()`. Über den Sync hereinkommende Firmen liefen
daran vorbei — Bestände über der Grenze waren möglich, und die Kopfzeile des Umschalters rechnete
dann sichtbar falsch („N von 5 angelegt").

**Behoben.** Globale Grabsteinliste `oyi_company_tombstones` (muss global sein: `Store.get()`
präfixt mit der Firmen-ID, der Grabstein läge sonst in der gelöschten Firma), wandert im
`__account`-Scope mit; `_merge` setzt für `oyi_companies` jetzt `entityType: 'firma'`; `delete()`
setzt den Grabstein vor dem Entfernen aus der Registry. Stück-Limit ersatzlos entfallen, einzige
Obergrenze ist serverseitig `MAX_SCOPES = 25` mit lesbarer Fehlermeldung.

**Reproduktion des alten Fehlers** (in `test/test-firmen-tombstones.js` als Gegenprobe fixiert):
`_mergeRecords(lokalOhneFirma, remoteMitFirma, {}, null)` liefert die Firma zurück,
mit `'firma'` statt `null` nicht mehr.

*Reste:* bestehende Dubletten in Altbeständen verschwinden nicht von selbst — sie lassen sich
seit diesem Fix aber normal löschen, und die Löschung hält über alle Geräte.

### 2.0 Materiallager ohne Sortierung und Filter — offen

**[geprüft 2026-08-23]** `js/lager.js` hat seit `c982264` sortierbare Spaltenköpfe und eine
Filterzeile im Tabellenkopf; die Helfer dazu liegen generisch in `js/utils.js`
(`sortIcon`/`toggleSort`/`sortComparator`/`bindSortableHeaders`, seit `ab95702`).

`js/materiallager.js` hat davon **nichts**: feste `sort()`-Aufrufe (u. a. `js/materiallager.js:194`
und `:278`), Header ohne `data-sort`, keine Filterleiste. Wer es nachzieht, braucht nichts Neues zu
bauen — die vier `Utils`-Funktionen und das CSS (`th.sorted-asc`/`sorted-desc`, `tr.lager-filter-row`)
sind vorhanden, es ist reine Anwendung des Musters aus `js/lager.js:_renderTable()`.

*Dringlichkeit: gering* — Nebenmodul, kleine Bestände, niemand hat es gemeldet. Bewusst nicht
mitgemacht, um den Kunden-Fund (Lager-Filterheader) nicht auszuweiten.


### 2.1 §25a Differenzbesteuerung — zwei Lücken

Beide fehlern Richtung **Überzahlung**, sind also steuerstrafrechtlich ungefährlich und kein
§14c-Risiko (der Rechnungsausweis ist nie betroffen, nur die interne UVA-Zahllast).

**a) Marge pauschal mit 19% statt möglicher 7%** — weiter offen, bewusst nicht angefasst
**[geprüft]**. `js/steuer-berechnung.js` (`margeEinzeldifferenz`/`margeGesamtdifferenz`, Parameter
`satz`), `js/ustvoranmeldung.js` (`_calcPeriode()`). Bei Kunstgegenständen, Sammlerstücken und
Antiquitäten kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 Nr. 49–53 der ermäßigte Satz gelten. Ein
UI-Hinweistext existiert, eine echte 7%-Berechnung nicht. *Dringlichkeit: gering* — betrifft die
aktuelle Zielgruppe (Freelancer, GbR, Gebrauchtwaren) kaum. Braucht laut Vorrecherche
„vertiefte Recherche der Anlage-2-Fälle" vor der Umsetzung (welche Warenart im Einzelfall
wirklich 7% ist) — das ist eine Rechtsfrage, kein Code-Fix, deshalb nicht blind implementiert.

**b) Retouren auf §25a-Positionen nicht aus der Marge gerechnet — ✅ erledigt 2026-08-09**
**[geprüft]**. Der Lookup-Mechanismus (`r.saleId` → Sale → Purchase, `_istDiff25aSale`) existierte in
`js/ustvoranmeldung.js` bereits (von einer parallelen Session gebaut), war aber wirkungslos: die
Korrektur wurde als `margeKorrektur`-Feld gepusht, das weder `margeEinzeldifferenz` noch
`margeGesamtdifferenz` je gelesen haben, und der `>750€`-Split-Filter hat `margeKorrektur`-Einträge
(ohne `einkaufspreis`) durch beide Filter fallen lassen (`undefined > 750` und `undefined <= 750`
sind beide `false`) — die Korrektur hatte de facto nie eine Wirkung. Per Node-Harness verifiziert
(Bemessungsgrundlage vorher fälschlich 50 statt 0 nach voller Retoure). Fix:
`SteuerBerechnung.margeGesamtdifferenz` liest jetzt `pos.margeKorrektur` mit ein, der Split-Filter
routet `margeKorrektur`-Einträge korrekt in den Gesamtdifferenz-Bucket. `js/euer.js` und
`js/gbr-modul.js` (informative §25a-Kachel, kein Einfluss auf Gewinn/USt) hatten noch gar keine
Retouren-Behandlung — dort direkt den Verkaufspreis der betroffenen Position um den
Erstattungsbetrag gemindert (funktioniert unabhängig vom Einzel-/Gesamtdifferenz-Floor-Problem,
da hier die Original-Position korrigiert wird statt eine neue Ausgleichsposition anzuhängen).
Bei Einzeldifferenz (Standard-Methode) bleibt eine strukturelle Lücke bestehen (§25a Abs. 3
erlaubt keine Verrechnung zwischen Positionen, Floor bei 0 pro Position verhindert eine
rückwirkende Korrektur der UVA) — das ist Gesetzeslogik, kein Code-Bug, und war schon vorher als
bewusst nicht angegangen dokumentiert (`plan/PLAN.md` → `differenzbesteuerung-25a-offene-luecken.md`).

### 2.2 Rechtstext-Inhalt in Local (D6) — ⛔ gegenstandslos (Local eingestellt 2026-08-11)

Die alte Prämisse ("beschreibt weiterhin Supabase + LemonSqueezy") war **bereits veraltet** —
per Grep über den ganzen `Local 1.7`-Ordner bestätigt: kein user-facing Text erwähnt Supabase
oder LemonSqueezy irgendwo. `datenschutz.html` beschrieb schon korrekt lokal-only Daten,
ECDSA-Lizenzschlüssel (`js/license.js`, kein Serveraufruf) und Paddle als Merchant of Record
(live verifiziert: echtes Paddle-SDK + Live-Token in `app.html`).

`legal-reviewer`-Agent hat trotzdem eine echte Vollständigkeitsprüfung gemacht (nicht nur die
alte Prämisse abgehakt) und drei reale Lücken gegen den Code gefunden + korrigiert:
- `js/app.js` (DSGVO-Hinweis-Modal) behauptete fälschlich "keine externen Ressourcen" —
  tatsächlich lädt `app.html` sechs CDN-Skripte (GSAP, Notyf, Flatpickr×2, QR, ApexCharts,
  Paddle.js) unconditional beim Start.
- `js/cookie-banner.js` sprach von Cookies "für Anmeldung/Session" — Local hat aber weder
  Login noch Server-Session (Rest aus der Web-1.7-Variante übernommen).
- `datenschutz.html`: neuer Abschnitt zu den CDN-Bibliotheken, Klarstellung dass Paddle.js
  schon beim App-Start lädt (nicht erst beim Kauf), Art. 13 Abs. 2 lit. f-Standardsatz zu
  automatisierter Entscheidungsfindung ergänzt.

Trial-Mechanik-Frage (Grund für den ursprünglichen "Trial + Offline-Lizenz"-Vermerk) geklärt:
Es gibt **keine funktionierende Trial-Mechanik** in Local — `UserPlan` wird an 8 Stellen
referenziert, ist aber nirgends definiert (toter Code, wohl unverändert aus Web 1.7 kopiert,
jede Prüfung `typeof UserPlan !== 'undefined'` ist permanent `false`). Einziger echter
Trial-ähnlicher Mechanismus ist der Demo-Lizenzschlüssel `OYI-DEMO-90-DAYS` (90 Tage,
regulärer `app_license`-Eintrag) — bereits korrekt in §2.2/§3 abgedeckt, keine Textänderung nötig.

**Offene Fragen — Entscheidungen 2026-08-09:**
1. Echter Consent-Banner vor dem Laden der CDN-Skripte (inkl. Paddle.js) in `app.html` — auf
   eigene Session verschoben, ausformulierter Prompt in
   `plan/session-prompt-local-consent-banner-2026-08-09.md`.
2. Aufsichtsbehörde namentlich nennen — ✅ erledigt: LfDI Baden-Württemberg (Königstraße 10a,
   70173 Stuttgart) in `datenschutz.html` §7 ergänzt.
3. Setzt Paddle.js beim bloßen Laden eigene Cookies/Storage zur Betrugserkennung? Weiterhin offen,
   Teil des Consent-Banner-Prompts oben (Punkt 1 dort).

Nebenbefund, außerhalb des Scopes nicht angefasst: `js/app.js:218` enthält toten, wirkungslosen
`SupabaseDB`-Code (durch `typeof`-Guard nie ausgeführt) — reiner Cleanup-Kandidat, keine
Rechtstext-Relevanz.

### 2.3 EU-ODR-Verweis in beiden Impressen — ✅ erledigt 2026-08-09 **[geprüft]**

`impressum.html` in Web *und* Local verwies auf die EU-Online-Streitbeilegungsplattform, die zum
**20.07.2025 eingestellt** wurde. Recherche (it-recht-kanzlei.de, wbs.legal, dhz.net) bestätigt:
Löschpflicht betrifft nur den Plattform-Hinweis/Link, der separate §36-VSBG-Nichtteilnahme-Satz
bleibt unverändert gültig — reine Streichung, keine neue Rechtsformulierung nötig. In beiden Dateien
entfernt.

### 2.4 Red-Team-Funde 2026-08-10 — offen **[geprüft]**

Aus dem Red-Team-Audit ([Funde](funde-audit-01-red-team-2026-08-10.md)). Kein Datenleck, aber
zwei Umsatz- und zwei Kostenlöcher. Reihenfolge nach Aufwand/Nutzen:

- **R3 — Owner-Allowlist auf `user_`-ID umstellen** 🟠 *(3 Einzeiler, sofort mitnehmbar)*
  `api/whop-access.js:181`, `api/sync.js:184`, `api/blob-upload.js:142` vergleichen den bei Whop
  **frei änderbaren** Usernamen gegen die Owner-Allowlist. Auf `me.sub` umstellen, Env-Variablen
  `SYNC_OWNER_USERNAMES`/`WHOP_OWNER_USERNAMES` → `*_OWNER_IDS`.
- **R2 + R6 — Scope- und Byte-Deckel pro Nutzer** 🟠
  `api/sync.js` erlaubt unbegrenzt viele Scopes (~200 GB/Tag Redis mit einem 15-€-Abo),
  `api/blob-upload.js` hat kein Speicherbudget (28 GB/h). Ein gemeinsamer Redis-Zähler-Block,
  analog zum vorhandenen Rate-Limit.
- **R4 — Grant-Deckel + Pubkey-Pflicht** 🟡
  Ein Pro-Abo kann per `action:'grant'` unbegrenzt fremde Whop-IDs autorisieren; jede davon
  bekommt über `StbShare.checkGrants()` vollen App-Zugang ohne eigenes Abo.
- **R8 — `username` aus `get_pubkey`-Antwort entfernen** 🟢 *(Einzeiler)* — Nutzer-Enumeration.
- **R5 — Sync-Key als nicht-extrahierbarer CryptoKey** 🟢 *(optional)* — heute liegen Schlüssel
  und Token beide als Rohwert in localStorage; ein XSS wäre Totalverlust. Kein akutes Loch
  (kein XSS gefunden, CSP blockt Inline-Handler), reine Schadensbegrenzung.

**Bewusst nicht fixen:** R1 (Client-Gate per Konsole umgehbar — bei Local-First architektur-
bedingt), R7/R9/R10 (Begründung je Fund in der Fund-Datei).

### 2.5 Security-Delta-Funde 2026-08-10 — ✅ **erledigt** **[geprüft]**

Aus dem Delta-Audit ([Funde](funde-audit-04-security-delta-2026-08-10.md)). Geprüft wurden die
Flächen, die der Sanierungs-Review (nur gegen den Diff) nie gesehen hat — **alle 6 Funde wurden
noch am 2026-08-10 von einer Parallel-Session gefixt** (Commits `623ec23`, `5b62268`, `9c395ad`,
`5388954`, `35c0cd6`, `cf152e9`). Am Code nachverifiziert:

- ✅ **S2** SheetJS `0.18.5` → **`0.20.3`** (CVE-2023-30533 + CVE-2024-22363), dazu
  `js/vendor/VERSIONS.md` mit SHA-256 und `.gitattributes` (`js/vendor/*.js -text`) — ohne das
  hätte `core.autocrlf=true` die dokumentierten Hashes beim Checkout zerstört.
  **Merke:** Bezug nur über `cdn.sheetjs.com`; ein `npm install xlsx` holt gezielt die
  verwundbare 0.18.5 zurück.
- ✅ **S1** gemeinsame `_isAllowedKey(scope, fullKey)` für Export **und** Import in
  `js/backup-crypto.js`.
- ✅ **S3** `_deriveKey(pass, salt, iterations, hash)` liest beides aus dem Dateiheader,
  `ITER_LEGACY = 210000` als Fallback für Alt-Dateien.
- ✅ **S6** `ITER = 600000` — korrekt **erst nach** S3 gehoben.
- ✅ **S4** Fingerabdruck-Abgleich in `js/stb-share.js`, **64 Bit** statt der vorgeschlagenen 32
  (der Angreifer ist per Annahme der Betreiber und kann offline grinden).
- ✅ **S5** HKDF-SHA-256 mit Versionsfeld `v:2` statt Formatbruch — bestehende StB-Freigaben
  bleiben gültig.

**Nebenbefund der Fix-Session, wichtig fürs Gedächtnis:** `js/backup-crypto.js` in **Local 1.7**
hing auf dem Stand vom 25.07. und hatte den AAD-Fix vom 30.07. nie bekommen — Local konnte in Web
erzeugte Backups gar nicht entschlüsseln, mit der irreführenden Meldung „Falsche Passphrase".
Datei ist wieder byte-identisch.

**Geklärt, nichts zu tun:** Local 1.7 braucht **keine** Spiegelung der Whop-/API-Fixes — es hat
weder `whop-auth.js` noch `api/` noch `cloud-sync.js` (nutzt `license.js`). Einziger Rest: toter
`AuthUI`-Aufruf in `Local 1.7/js/app.js:95-103` (harmlos, Aufräumkandidat).

**Bleibt bei dir** (alles braucht einen Whop-Login): Edge-Tastaturtest der Gate-Overlays ·
Excel-Import-Klickdurch mit echter Datei · 2-Account-Test des Fingerabdruck-Abgleichs.

### 2.6 Steuer-Vergleich-Funde 2026-08-10 — offen **[geprüft]**

Aus dem Steuer-Vergleich ([Funde](funde-audit-05-vergleich-steuer-2026-08-10.md)).
Rechtsstände per Recherche für das Prüfjahr verifiziert.

- **T1 — KSA-Satz jahresabhängig machen** 🔴 *(einziger Punkt mit falschen Zahlen)*
  `js/ausgaben.js:16-17` hat `_KSA_SATZ: 0.049` und `_KSA_BAGATELLGRENZE: 1000` als feste
  Konstanten. Für 2026 korrekt, aber **ab 1.1.2027 steigt der Abgabesatz wieder auf 5,0 %**
  (bereits verkündet) — dann rechnet Stackr still zu niedrig. Für 2025-Daten ist es schon jetzt
  falsch (damals 5,0 % / 700 €). Fix: `_getKsaWerte(year)` analog zum vorhandenen
  `_getUstGrenzen(year)` in `js/app.js:1039`, ~10 Zeilen, 2027er-Wert gleich mit eintragen.
- **T3 — Steuertermine vervollständigen** 🟠
  `js/steuertermine.js:5-18` listet 10 feste Termine. Fehlt: **UStVA-Monatsrhythmus** (Pflicht ab
  7.500 € USt Vorjahr — trifft genau die wachsenden Nutzer), Dauerfristverlängerung inkl.
  1/11-Sondervorauszahlung, §108-Abs.-3-AO-Verschiebung auf den nächsten Werktag, sowie die
  Lohnsteuer-Anmeldung (obwohl `js/lohnsteuer.js` existiert).
- **T6 — Leitweg-ID-Feld ins Rechnungsformular** 🟡 *(kleiner Fix, öffnet B2G)*
  `rechnungen/js/xrechnung.js:256-258` schreibt `<ram:BuyerReference>` korrekt, wenn
  `inv.leitwegId` gesetzt ist — es gibt aber nirgends ein Eingabefeld dafür.
- **T4 — Cloud-Anker im Protokoll-Modul bewerben** 🟠
  Audit-Log-Zeitstempel ist Client-Zeit; Rückdatierung per Systemuhr bleibt ohne Cloud-Anker
  unerkannt. Der Anker (`api/sync.js` serverseitiges `ts`) löst es, ist aber opt-in und wird nicht
  erklärt. Hinweis + Aktivierungs-Link im Protokoll.
- **T2 — GoBD-/IDEA-Z3-Export** 🟠 *(größter Posten, erst bei StB-Nachfrage)*
  §147 VI AO. Lexware und sevDesk liefern ihn; Stackr hat nur den DATEV-Buchungsstapel.
- **T5, T7 — reine Hinweistexte** 🟡
  KSA-Bagatellgrenze gilt nicht für „typische Verwerter" (§24 Abs. 1 KSVG) → Hinweis an der Kachel.
  Kein IDW-PS-880-Testat → im Marketing **nie „GoBD-zertifiziert"** schreiben, sondern
  „GoBD-konform umgesetzt" mit Verweis auf die mitgelieferte Verfahrensdokumentation.


### 2.7 Steuer-Delta-Funde 2026-08-11 — offen **[geprüft]**

Aus dem Delta-Audit ([Funde](funde-audit-10-steuern-delta-2026-08-10.md)).

- **D2 — Lager-Massenoperationen ins Audit-Log aufnehmen** 🔴 *(einziger Fund mit Prüfungsrisiko)*
  `lager/page.js:1627, 2015-2016, 2454, 2465` schreiben `purchases` und `sales` direkt über
  `Store.setAsync()` — das ist ein reiner Schreibpfad **ohne** `_addAuditEntry`. Batch-Import und
  Massen-Statuswechsel erzeugen damit Wareneinkäufe und Betriebseinnahmen ohne jeden
  Protokolleintrag (§146 Abs. 4 AO / GoBD Rz. 64). Fix: Sammel-Eintrag über das vorhandene
  `_addAuditEntriesBatch()` (`js/store.js:1089`) oder ein Eintrag pro Import mit Anzahl und Summe
  im `details`-Feld; die Aktionsart `import` existiert bereits.
- **D1 — Veraltete Sperre für gemischte Steuersätze entfernen** 🟠
  `rechnungen/js/dokumente.js:28-31` und `660-663` blocken Teilzahlungen bei 7 %+19 %-Rechnungen
  mit einer Begründung, die nicht mehr zutrifft — `createSaleFromInvoice()` teilt längst
  proportional auf (`sale.steuersaetze`), die UVA liest es korrekt. Die Sperre zwingt zum Warten
  auf die Schlusszahlung und verursacht dadurch genau den **§11-EStG-Zuflussfehler**, den die
  Teilzahlungs-Logik verhindern soll. Vor dem Entfernen einen Testfall anlegen
  (7 %+19 % → Teilzahlung → UVA-Kennzahlen prüfen).
### 2.11 Accessibility-Funde 2026-08-12 — offen **[geprüft]**

Aus dem WCAG-2.1-Rest-Check ([Funde](funde-audit-12-accessibility-2026-08-10.md)).
Kontrastwerte berechnet, nicht geschätzt.

- **A1 — Akademie tastaturbedienbar machen** 🔴 *(Level A, ~30 Min, größter Einzelfund)*
  `js/akademie.js` hat **null** `aria-`/`role=`/`tabindex`-Attribute. Modulkarten (Z. 2127),
  Lektionszeilen (Z. 2250) und der Weiterlesen-Banner (Z. 2061) sind `<div>` mit `cursor:pointer`
  und nur `click`-Handlern — `keydown`: 0 Treffer. Ein Tastatur- oder Screenreader-Nutzer kann
  **kein einziges Modul öffnen**. Fix: `role="button"` + `tabindex="0"` + Enter/Space-Handler
  an allen drei Elementtypen (WCAG 2.1.1 + 4.1.2).
- **A2 — Eigene Randfarbe für Formularfelder** 🟠 *(Level AA, 2 Zeilen)*
  `.form-input` hat **1,47:1** Randkontrast (Ziel 3:1), und die Feldfüllung hebt sich mit
  **1,09:1** gegen die Karte praktisch nicht ab — weder Rand noch Füllung zeigen, wo ein Feld
  ist (WCAG 1.4.11). Fix: `--border-field: #4a5651` (≈3,0:1) einführen und nur in
  `.form-input/.form-select/.form-textarea` verwenden, damit die dezenten Trennlinien im Rest
  der Oberfläche unverändert bleiben. **Der Fokus-Zustand ist unproblematisch** (7,54:1).
- **A3 — Lager: Tastaturpfad für klickbare Zeilen/Kacheln** 🟠 *(Level A)*
  11 `cursor:pointer`-Elemente in `lager/page.js`. Die Tabellenzeile (Z. 129) ist entschärft,
  weil eine echte Checkbox als Ersatzweg existiert; die Foto-Kachel (Z. 623) hat keinen —
  dort besser `<label>` + verstecktes `<input type="file">`.
- **A4 — Skip-Link** 🟡 *(Level A, 4 Zeilen)* — „Zum Inhalt springen" in die vier App-Seiten.
- **A5 — Landmarks benennen** 🟡 — `aria-label="Anwendungen"` an die Topnav und
  `aria-label="Module"` an die Sidebar; bei **zwei** Navigationen relevant.

**Nicht automatisierbar, bleibt beim Nutzer:** Edge-Tastaturtest (die Logik ist geprüft, die
Wahrnehmung nicht) · Farbblindheits-Sichtprüfung der ApexCharts — in Tabellen ist es durch
`+`/`−`-Vorzeichen und Text-Badges entschärft, in den Charts trägt allein die Farbe.

### 2.10 Compliance/Legal-Funde 2026-08-12 — offen **[geprüft]**

Aus dem Compliance-Lauf ([Funde](funde-audit-11-compliance-legal-2026-08-10.md)).
Kein Anwaltsersatz — technische Prüfung.

- **L1 — Die beiden In-App-AGB-Modale auf `agb.html` umstellen** 🔴 *(vor Launch)*
  `js/app.js:927` und `rechnungen/js/app.js:227` zeigen eine **andere, ältere** AGB-Fassung als
  `agb.html`: 8 statt 11 Paragraphen, **ohne Widerrufsrecht, ohne Preise, ohne Whop** — Stand vor
  der Whop-Migration. Das Modal erscheint **nach** dem Vertragsschluss und blockiert bei Ablehnung
  die Nutzung. Folge: keine wirksame Einbeziehung (§305 II BGB), und die Unklarheitenregel
  (§305c II) entwertet ausgerechnet den **Haftungsausschluss**, der der Zweck des Modals ist.
  Fix: Modal auf eine Kurzfassung (kein steuerlicher Rat · Nutzung auf eigene Gefahr ·
  Datensicherung beim Nutzer) plus Link auf `agb.html` reduzieren.
- **L3 — `agb.html` in den App-Footer** 🟠 *(vier Einzeiler, gehört zu L1)*
  `app.html`, `lager/`, `rechnungen/`, `eigenbelege/` verlinken nur Impressum und Datenschutz.
  §312i Abs. 1 Nr. 4 BGB verlangt abrufbare Vertragsbedingungen.
- **L2 — `agb_accepted` mit Versionsstand** 🟠
  Gespeichert wird ein Zeitstempel, keine Version → eine AGB-Änderung erreicht **keinen**
  Bestandsnutzer. §9 der eigenen AGB (Änderungsvorbehalt) ist so nicht umsetzbar (§308 Nr. 5 BGB).
- **L4 — „Cookies" → „lokale Speicherung"** 🟢 *(ein Satz)* — `js/cookie-banner.js:34`.
  Der fehlende Ablehnen-Button ist dagegen **korrekt** (§25 Abs. 2 Nr. 2 TDDDG).
- **L5/L6 — warten auf Dritte:** Whop-DPA (Art. 28 DSGVO; zusätzlich **Upstash und Vercel**
  prüfen) · Anwalts-Freigabe AGB §11 + §356a. Siehe Abschnitt 3.

### 2.8 UI-Checker-Funde 2026-08-11 — offen **[geprüft]**

Aus dem app-weiten UI-Lauf ([Funde](funde-audit-06-ui-checker-2026-08-10.md)). Damit ist auch der
alte Punkt „`ui-politur` — keine konkrete Fundliste vorhanden" erledigt.

- **C1 — `.action-btn`-CSS ergänzen** 🔴 *(ein CSS-Block, größter sichtbarer Effekt)*
  `.action-btn` und die vier Modifier (`-accent`, `-danger`, `-success`, `-warning`) sind
  **nirgends definiert**, und `css/style.css` hat auch kein globales `button{}` als Auffangschirm.
  Ergebnis: **34 graue Browser-Standardknöpfe** in Eigenbelege, Rechnungen/Dokumente,
  Wiederkehrend, GbR und Lager; die beabsichtigte Farbcodierung existiert visuell gar nicht.
  Vorlage für den CSS-Block steht in der Fund-Datei.
- **C2 — `.akademie-tip`-CSS ergänzen** 🟠 — **43 Merkkästen** rendern als normaler Fließtext.
- **C3** `.data-table` (15×) undefiniert, globales `table{}` fängt es ab — definieren oder entfernen.
- **C4** Kommentar `js/app.js:6` verweist auf `index.html`; das Versions-Badge steht in
  `app.html:188`, die Landingpage hat gar keins.

*Kein Design-System-Drift* — der Verdacht hat sich nicht bestätigt (ApexCharts-Literale mit
korrekter `isDark`-Verzweigung, Druck-Stylesheet der Rechnung, Farbpaletten als Daten).

### 2.9 Performance-Funde 2026-08-11 — offen **[geprüft]**

Aus dem Performance-Lauf ([Funde](funde-audit-09-performance-2026-08-10.md)). Größen gemessen.

- **F1 — `defer` an die drei Sub-Apps** 🔴 *(reine Attribut-Ergänzung, größter Einzelgewinn)*
  `app.html` ist optimiert (63 von 67 Scripts mit `defer`), die Sub-Apps nicht:
  `rechnungen/` ~31 blockierende Tags, `eigenbelege/` ~21, `lager/` ~20.
  `eigenbelege/index.html:19-22` lädt Chart.js, **ApexCharts (~600 KB)**, GSAP und Notyf
  **im `<head>` ohne defer**. Danach Stufe 2: ApexCharts dort lazy laden — `_ensureApexCharts()`
  aus `js/dashboard.js:11` ist fertig und kann übernommen werden.
- **F2 — `xlsx.full.min.js` lazy laden** 🔴 — **929 KB**, größte Datei des Projekts, lädt bei
  jedem App-Start; gebraucht nur beim Excel-Import.
- **F3 — `chart.min.js` aus `eigenbelege/index.html` entfernen** 🟠 *(eine Zeile)* — 200 KB, dort
  ungenutzt. Mittelfristig prüfen, ob `js/statistiken.js` auf ApexCharts umgestellt werden kann;
  dann fällt eine von zwei Chart-Bibliotheken weg.
- **F4** `preload` für Font/`style.css`/`app.js` ergänzen 🟢 *(3 Zeilen, Font wirkt am stärksten)*.
- **F6 — Cloud-Sync: Web Worker statt Delta-Sync** 🔴 — der komplette Blob wird immer übertragen
  und AES-GCM läuft im Main-Thread. **Kein Delta-Sync bauen** (CAS/Merge sind korrekt und
  getestet) — stattdessen Ver-/Entschlüsselung auslagern und sichtbare Rückmeldung zeigen.
- **F5** (Tabellen per `innerHTML`) und **F7** (`setInterval` ohne clear): erst messen bzw.
  Einzeiler. F5 bleibt folgenlos, solange die Event-Delegation greift.


---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe der Rechtstexte** — AGB §11, Trial-/Widerrufsklausel (§356 BGB).
  Punkt 2.2 (Local D6) entfällt mit der Local-Einstellung, Punkt 2.3 (EU-ODR) ist erledigt.
- **Whop-DPA / AV-Vertrag** — seit Längerem offen, blockiert die DSGVO-Vollständigkeit.

---

## 4. Nur du kannst das testen

Diese Punkte sind gebaut und committet, aber nie unter echten Bedingungen gelaufen — sie brauchen
echte Logins, zwei Accounts oder externe Dienste:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen) **[Memory]**
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen **[Memory]**
- **StB-Zugang mit zwei Accounts** (Offline-Grace + Read-Only) **[Memory]**
- **Lager-Feature-Batch, Punkt 10** — Live-Durchklick **[Memory]**

---

## 5. Aufräumen — beide Punkte ✅ erledigt

### 5.1 Test-Harnesses — ✅ erledigt (Commit `b11dcbb`) **[geprüft]**

Alle `test-*.js` liegen jetzt in `test/`, nichts mehr ungetrackt im Repo-Root (14 Dateien
inzwischen, weitere aus der technischen Sanierung dazugekommen).

### 5.2 `PLAN.md` Status-Durchgang — ✅ erledigt 2026-08-09 **[geprüft]**

19 abgeschlossene Session-Prompt-Abschnitte durchgestrichen (Überschrift `~~...~~` + Verweis auf
diese Datei), analog zu `session-prompt-whop-checkout-nachpruefung.md`.

---

## 6. Erledigt — nicht nochmal anfangen

Diese Abschnitte stehen in `PLAN.md` noch unmarkiert unter „offen", sind es aber nicht:

| Abschnitt | Stand |
|---|---|
| `ch-at-entfernen` | Web bereinigt 2026-07-16; die CH-Ausnahme für Local ist mit der Einstellung gegenstandslos |
| `local-sync-*` (alle Spiegelungs-Prompts) | ⛔ gegenstandslos — Local wird seit 2026-08-11 nicht mehr gespiegelt |
| `teilzahlung-ratenzahlung`, `zufluss-teilzahlung-steuermodule` | committet `e771cdb` **[geprüft]** |
| `whop-checkout-nachpruefung` | erledigt 2026-07-30, als einziges markiert **[geprüft]** |
| `onboarding-rebuild` | Firmenname-Label committet `4949b31` **[geprüft]** |
| `lager-feature-batch` | bis auf Live-Test fertig **[Memory]** |
| `offline-grace-stb`, `stb-gate-revoke`, `stb-luecken` | gebaut; Revoke-Logik in `js/stb-share.js` vorhanden **[geprüft]** |
| `blob-sync`, `vercel-blob-empfaenger` | `api/blob-upload.js` + `js/blob-attachments.js` existieren **[geprüft]** |
| `landing-seo` | Meta-Description, Canonical, OG-Tags, `robots.txt`, `sitemap.xml` vorhanden **[geprüft]** |
| `persona-cta-touch-target` | 44px-Touch-Targets in `css/style.css` **[geprüft]** |
| `performance-a11y` | 63 `defer`-Scripts in `app.html`, A11y-Vollaudit abgeschlossen **[geprüft]** |
| `makecom-webhook` | committet `4cbd40d`, nur Live-Test offen **[Memory]** |
| `rechnung-eigenbeleg-vollaudit`, `vollaudit-a11y-rest` | alle Funde abgearbeitet **[Memory]** |

`ui-politur` ist der einzige aus dieser Gruppe, der laut Memory noch echte Restarbeit hat
(„High-End-Politur" am Finanzen-Modul) — ohne konkrete Fundliste.

---

## Zwei Fallen, die wiederholt Zeit gekostet haben

**Browser-Cache.** `python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am
Origin. `location.reload()`, Cache-Bust-Query **und ein neuer Tab** liefern trotzdem alten Code —
man verifiziert dann den Vorher-Zustand und hält einen ungefixten Bug für gefixt. Einzig
zuverlässig: **neuer Port** in `.claude/launch.json`. `eval` zum Nachladen scheitert an der CSP.
Für reine Rechenlogik ist ein Node-`vm`-Harness schneller und cache-immun.

**~~Drift läuft in beide Richtungen.~~** ⛔ Mit der Local-Einstellung (2026-08-11) hinfällig —
es wird nicht mehr gespiegelt, die Diff-Prüfregel entfällt. **Ein Rest bleibt relevant:** Local war
bei der Input-Härtung (`maxlength`, `min`/`max`, `Number.isFinite`) an einigen Stellen *voraus*.
Falls Web dort noch Lücken hat, ist das jetzt ein eigenständiger Web-Fund — nicht mehr eine
Spiegelungsaufgabe. Wurde nie systematisch erhoben; bei Gelegenheit als Web-Audit nachholen.
