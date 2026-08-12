# Übergabe — Stackr Web 1.7, Stand 2026-08-12

Diese Datei ist als **Einstieg für eine neue Session** gedacht und steht für sich: sie nennt jeden
offenen Punkt mit Datei, Zeile und Begründung, dazu die Arbeitsregeln, die in diesem Repo
wiederholt Zeit gekostet haben. Wer sie liest, braucht die Vorgeschichte nicht.

Alle Statusangaben unten sind am **2026-08-12 gegen den Code geprüft**, nicht aus älteren
Plan-Dateien übernommen. Das war nötig: `plan/OFFEN.md` führte mehrere Punkte noch als „offen",
die längst committet sind.

---

## 0. Was du in 30 Sekunden wissen musst

- **Nur `Web 1.7` wird gepflegt.** `Local 1.7` ist seit 2026-08-11 eingestellt (Entscheidung des
  Users). Der Ordner bleibt liegen, wird aber **nicht mehr gespiegelt**. Jede ältere Notiz, die
  eine „Local-Spiegelung" als offene Aufgabe führt, ist gegenstandslos.
- **Ausnahme:** Der **Local-Import in Web** (`js/backup-crypto.js`, Firmen-Auswahl beim Import)
  bleibt und muss funktionsfähig bleiben — er ist der Migrationspfad für Bestandsdaten und der
  einzige Grund, warum Local überhaupt noch eine Rolle spielt.
- **Dieses Repo wird von mehreren Sessions gleichzeitig bearbeitet.** Das ist kein Sonderfall,
  sondern der Normalzustand. Regeln dazu in Abschnitt 5 — bitte vor dem ersten Commit lesen.
- **Code-seitig ist das meiste fertig.** Was übrig ist, steht in Abschnitt 1 (Performance-Block,
  drei Posten) und Abschnitt 2 (braucht den User). Der Rest wartet auf Anwalt und Whop.

---

## 1. Offene Code-Arbeit

### 1.1 Performance — der einzige Block mit mehreren offenen Posten

Quelle: [`funde-audit-09-performance-2026-08-10.md`](funde-audit-09-performance-2026-08-10.md).
Größen sind gemessen, nicht geschätzt.

| ID | Was | Status 2026-08-12 |
|---|---|---|
| **F1** | `defer` an die drei Sub-Apps | **offen** |
| **F2** | `xlsx.full.min.js` (929 KB) lazy laden | **offen** |
| **F3** | `chart.min.js` aus `eigenbelege/` entfernen | **offen** |
| **F6** | Cloud-Sync-Krypto in einen Web Worker | **offen** |
| F4 | `preload` ergänzen | teilweise — die zwei Fonts sind drin, `style.css`/`app.js` fehlen |
| F5 / F7 | Tabellen per `innerHTML`, `setInterval` ohne `clear` | niedrig, erst messen |

**F1 — `defer` an die Sub-Apps** 🔴 *(reine Attribut-Ergänzung, größter Einzelgewinn)*
`app.html` ist optimiert (63 von 67 Scripts mit `defer`), die drei Sub-Apps sind es nicht.
`eigenbelege/index.html:20-25` lädt **im `<head>` ohne `defer`**: `chart.min.js`, ApexCharts
(~600 KB), GSAP, Notyf und Flatpickr ×2. `rechnungen/` hat ~31 blockierende Tags, `lager/` ~20.
Danach als Stufe 2: ApexCharts dort lazy laden — `_ensureApexCharts()` in `js/dashboard.js:11` ist
fertig und kann übernommen werden.

**F2 — `xlsx.full.min.js` lazy laden** 🔴
929 KB, die größte Datei des Projekts, lädt bei **jedem** App-Start. Gebraucht wird sie nur beim
Excel-Import. Es gibt aktuell keinen Lazy-Loader dafür (geprüft: kein `_ensureXlsx` o.ä.).
Muster steht mit `_ensureApexCharts()` bereit.
**Achtung beim Anfassen:** SheetJS ist nur über `cdn.sheetjs.com` beziehbar; ein `npm install xlsx`
holt gezielt die verwundbare 0.18.5 zurück (CVE-2023-30533, CVE-2024-22363). Aktuell liegt 0.20.3
lokal in `js/vendor/` mit SHA-256 in `js/vendor/VERSIONS.md`.

**F3 — `chart.min.js` aus `eigenbelege/index.html:20`** 🟠 *(eine Zeile)*
200 KB, dort ungenutzt. Mittelfristig prüfen, ob `js/statistiken.js` auf ApexCharts umgestellt
werden kann — dann fällt eine von zwei Chart-Bibliotheken ganz weg.

**F6 — Cloud-Sync: Web Worker** 🔴
Der komplette Blob wird immer übertragen, und AES-GCM läuft im Main-Thread (geprüft: kein
`Worker(` in `js/cloud-sync.js`). **Keinen Delta-Sync bauen** — CAS und Merge sind korrekt und
getestet, da soll niemand ran. Stattdessen Ver-/Entschlüsselung auslagern und dem Nutzer eine
sichtbare Rückmeldung geben.

### 1.2 Kleiner Rest aus dem UI-Checker

`css/style.css` ist **gerade von einer anderen Session in Arbeit** (uncommittet). Die dort
gemeldeten Lücken C1 (`.action-btn`, 34 graue Standardknöpfe), C2 (`.akademie-tip`, 43 Merkkästen)
und C3 (`.data-table`) sind im aktuellen Arbeitsstand der Datei **definiert** — also
höchstwahrscheinlich schon erledigt, aber noch nicht committet. **Vor dem Anfassen: `git log` und
`git status` prüfen und die Session fragen.** C4 (falscher Kommentarverweis in `js/app.js:6`) ist
erledigt, der Kommentar zeigt jetzt korrekt auf `app.html`.

---

## 2. Braucht den User — nichts davon kann eine Session allein erledigen

### 2.1 Eine ENV-Variable, die eine Sicherheitslücke offen lässt 🟠

Der Code-Fix zu **R3** ist drin: `api/sync.js:47`, `api/blob-upload.js:44` und
`api/whop-access.js:46` bevorzugen jetzt `SYNC_OWNER_IDS` / `WHOP_OWNER_IDS` (unveränderliche
Whop-User-IDs, `user_…`).

**Aber:** Solange diese Variablen in Vercel leer sind, greift der Altweg — der Vergleich gegen den
bei Whop **frei änderbaren Benutzernamen**, mit dem hart kodierten Default
`'secondlifevintage41'`. Wer sich diesen Namen bei Whop gibt, bekommt Owner-Rechte ohne Abo.

→ **Zu tun:** In Vercel `SYNC_OWNER_IDS` und `WHOP_OWNER_IDS` auf die echte Whop-User-ID setzen,
danach die alten `*_OWNER_USERNAMES`-Variablen löschen. Reine Konfigurationsarbeit, kein Code.

### 2.2 Vier Live-Tests

Gebaut und committet, aber nie unter echten Bedingungen gelaufen — brauchen echte Logins, zwei
Accounts oder externe Dienste:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen)
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen
- **StB-Zugang mit zwei Accounts** (Offline-Grace + Read-Only, inkl. Fingerabdruck-Abgleich)
- **Lager-Feature-Batch, Punkt 10** — Live-Durchklick
- dazu aus dem Security-Audit: Edge-Tastaturtest der Gate-Overlays, Excel-Import mit einer echten
  Datei

**Wichtig für jede Session:** Claude loggt sich **nicht** selbst bei Whop ein. Wenn ein Test einen
Login braucht, meldet sich der User einmal im Browser-Pane an; die Session bleibt danach erhalten.
Ein Dev-Bypass im Code ist ausdrücklich nicht gewünscht.

---

## 3. Wartet auf Dritte — nicht durch Coden lösbar

- **Anwalts-Freigabe der Rechtstexte** — AGB §11 und die Trial-/Widerrufsklausel (§356 BGB).
- **Whop-DPA / AV-Vertrag** — blockiert die DSGVO-Vollständigkeit.
- **§25a, ermäßigter Satz von 7 %** — `js/steuer-berechnung.js`
  (`margeEinzeldifferenz`/`margeGesamtdifferenz`, Parameter `satz`) und `js/ustvoranmeldung.js`
  (`_calcPeriode()`) rechnen die Marge pauschal mit 19 %. Bei Kunst, Sammlerstücken und Antiquitäten
  kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 Nr. 49–53 der ermäßigte Satz gelten. Der Fehler geht
  Richtung **Überzahlung**, ist also steuerstrafrechtlich ungefährlich und betrifft die aktuelle
  Zielgruppe kaum. Vor der Umsetzung braucht es eine Rechtsrecherche, welche Warenart im Einzelfall
  wirklich 7 % ist — **nicht blind implementieren.**

---

## 4. Bewusst nicht anfassen

Damit das nicht bei jedem Audit neu aufschlägt:

- **Hex-Farben in JS.** 270 Vorkommen, die große Mehrheit ist korrekt so: `js/steuerberater.js`
  (~59 — baut ein eigenständiges Download-HTML mit eigenem `<style>`, CSS-Variablen sind dort nicht
  verfügbar), `js/companies.js` (Farbwähler — der Hex-Wert *ist* die Nutzdatenangabe),
  `js/statistiken.js` (Chart.js zeichnet auf Canvas), `store.js`/`akademie.js`/`lager.js` (ICONS-
  und Status-Maps). **Echte Funde sind nur:** `var(--primary)` (das Token existiert nicht) und
  `var(--token,#hex)`-Fallbacks mit veralteten Werten — beide aktuell auf null. Einzige Ausnahme:
  `--warning-rgb` hat als einziges kein definiertes Token, sein Fallback feuert also wirklich.
- **R1** (Client-Gate per Konsole umgehbar) — bei Local-First-Architektur systembedingt.
- **Delta-Sync für Cloud-Sync** — siehe F6.
- **Marketing-Wording:** nie „GoBD-zertifiziert" schreiben (kein IDW-PS-880-Testat), sondern
  „GoBD-konform umgesetzt" mit Verweis auf die Verfahrensdokumentation. Aktuell steht der falsche
  Begriff nirgends — bitte so lassen.
- **Local 1.7** — nicht mehr spiegeln, nicht mehr fixen, nicht löschen.

---

## 5. Arbeitsregeln in diesem Repo

**Parallele Sessions sind der Normalfall.** Am 2026-08-11/12 liefen bis zu fünf gleichzeitig.

- `git status` **erneut** prüfen, unmittelbar bevor du committest — nicht nur beim Sessionstart.
- **Immer pfad-gescoped committen** (`git add -- <datei>`), nie `git add -A`. Sonst nimmst du
  fremde Arbeit mit. Das ist am 2026-08-12 zweimal passiert: Teile einer Härtungsarbeit landeten
  in `365d930` und `7c07104`, weil andere Sessions die Dateien mitcommittet haben.
- **Uncommittete Arbeit bleibt hier nicht lange liegen.** Wer fertig ist, committet sofort.
- Urheberschaft **belegen, nicht raten**: `search_session_transcripts` nach Dateiname plus
  mtime-Abgleich gegen `lastActivityAt` (Achtung: `lastActivityAt` ist UTC, mtimes lokal,
  CEST = UTC+2). Eine Session hat schon einmal eine fremde Änderung falsch zugeordnet.
- Wenn du eine Datei brauchst, die jemand anders hält: per `send_message` abstimmen, nicht
  überschreiben.

**Die Browser-Cache-Falle.** `python -m http.server` schickt keine No-Cache-Header, und der Cache
hängt am Origin. `location.reload()`, Cache-Bust-Query **und ein neuer Tab** liefern trotzdem
alten Code — man verifiziert dann den Vorher-Zustand und hält einen ungefixten Bug für gefixt.
Einzig zuverlässig: **neuer Port** in `.claude/launch.json` (3333–3413 sind vergeben, nimm 3414+).
`eval` zum Nachladen scheitert an der CSP. Für reine Rechenlogik ist ein Node-`vm`-Harness
schneller und cache-immun.

**Verifikation hinter dem Whop-Gate.** Der Gate rendert den Seiteninhalt nicht ohne Login. Man
kommt trotzdem an die Formulare, indem man die Modul-Renderer direkt aufruft
(`App.showSettingsModal()`, `Retouren.render()`, `Fahrtenbuch._renderForm()` + `_bindForm()`) und
das Ergebnis in `#mainContent` hängt. Toasts rendern verzögert — nicht im DOM danach suchen,
sondern `Utils.showToast` kurz instrumentieren und die Aufrufe mitschneiden.

**Encoding.** Das Repo ist UTF-8 **ohne** BOM. Dateien nie über eine PowerShell-Textpipeline
schreiben (`Set-Content`, `Out-File`) — das zerschießt die Umlaute. Edit/Write-Tools oder Python
mit `encoding='utf-8', newline=''` benutzen.

---

## 6. Was zuletzt passiert ist

Zur Einordnung, falls ein Commit-Verweis unklar ist:

| Commit | Inhalt |
|---|---|
| `641840b` | Input-Härtung: Negativwerte in Retouren, Fahrtenbuch und Excel-Import; 66 `maxlength` |
| `2ceb086` | Feature-Gap G1/G2/G7–G10 — Entscheidungen dokumentiert statt halb gebaut |
| `365d930` | G6 Zahlungslink auf der Rechnung |
| `7c07104` | Steuer-Fix D1/D2 — Lager-Massenoperationen protokollieren, Teilzahlungssperre weg |
| `caedf9f` | T2 — Datenträgerüberlassung Z3 für die Betriebsprüfung (§147 Abs. 6 AO) |
| `3172635` | T3 — Fristenkalender nach Rhythmus, Dauerfrist, §108 AO |
| `631bcd7` | T5/T6 — Leitweg-ID-Feld für B2G, KSA-Verwerter-Hinweis |
| `41b21b6` | T4 — Uhr-Rücksprünge im Audit-Log erkennen |
| `eafc902` | R5 — Sync-Schlüssel aus localStorage in IndexedDB |
| `d87f9d0` | R7/R8 — AAD-Fallback mit Ablaufdatum, kein Benutzername in `get_pubkey` |
| `541f8d9` | R6 — Byte-Budget für Blob-Uploads |
| `9f86e88` | Cloud-Sync — keine zwei Schlüssel mehr, ehrliche Fehler, Diagnose + Notausgang |

**Erledigt und nachverifiziert** (nicht nochmal anfangen): R2, R3 (Code — ENV s. 2.1), R4, R5, R6,
R8 · T1 bis T7 · D1, D2 · S1 bis S6 · C4 · §25a-Retouren · EU-ODR-Verweis · Test-Harnesses nach
`test/` · `PLAN.md`-Statusdurchgang.

---

## 7. Wo was steht

- `plan/OFFEN.md` — die gepflegte Statusliste. **Achtung:** wird laufend von einer anderen Session
  bearbeitet und war am 2026-08-12 an mehreren Stellen älter als der Code. Im Zweifel gegen den
  Code prüfen, so wie diese Datei es getan hat.
- `plan/funde-gesamt-2026-08-10.md` — Sammelübersicht aller Audit-Funde.
- `plan/funde-audit-01…10-*.md` — die einzelnen Audits mit Datei:Zeile je Fund.
- `plan/rest-offen-2026-08-11.md` — die Local-Restliste, mit der Einstellung erledigt.
- `plan/PLAN.md` — Archiv der ausformulierten Prompt-Texte. Nicht als Arbeitsliste benutzen:
  es enthält viel Erledigtes ohne Markierung.
- `test/` — 14+ Node-Harnesses, cache-immun, gut als Vorlage für neue Rechen-Tests.
