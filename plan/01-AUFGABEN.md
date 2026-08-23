# Was noch zu tun ist

**Stand: 2026-08-23**, jeder Punkt an diesem Tag gegen den Code verifiziert — nicht aus einer
Vorgängerliste übernommen.

Einstieg: [`00-STAND.md`](00-STAND.md) · Nicht-zu-Ändern: [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)
· Abgeschlossenes: [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md)

> **Diese Datei enthält nur noch Offenes.** Alles Erledigte ist am 2026-08-16 nach
> [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md) ausgelagert worden — mitsamt den Korrekturen, wo
> die Umsetzung von der ursprünglichen Aufgabenbeschreibung abwich. Wer wissen will, *wie* etwas
> gebaut wurde, schaut dort nach; wer etwas zu tun sucht, bleibt hier.
>
> Das ist bewusst **eine** Aufgabenliste geblieben, keine zweite daneben — die Doppelung
> `restliste-2026-08-14.md` ↔ dieser Datei hat am 2026-08-15 eine ganze Session gekostet, weil
> acht längst erledigte Funde weiter als offen geführt wurden. Siehe
> [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md), Abschnitt 2.

Getrennt nach **wer es machen kann**: Abschnitt 1 kann jede Session sofort greifen, Abschnitt 2
braucht dich, Abschnitt 3 wartet auf Dritte.

> ⚠️ **Vor dem Anfassen `git status` prüfen.** Mehrere der genannten Dateien werden regelmäßig
> von parallelen Sessions gehalten. Details in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md).

> ⚠️ **Diese Liste veraltet binnen Stunden — dreimal belegt.** Am 2026-08-15 waren von sechs
> frisch eingetragenen „offenen" Punkten zwei Stunden später vier bereits gebaut. Am 2026-08-16
> wiederholte sich das: M1, M2, M4 und U7 standen hier als offen und waren binnen zwei Stunden
> von parallelen Sessions erledigt. **Immer erst gegen den Code prüfen, dann greifen** — auch bei
> einer Liste mit dem heutigen Datum, auch bei dieser hier.

---

## 1. Code — kann jede Session machen

**Zwei neue Bauaufgaben** aus den Produktentscheidungen vom 2026-08-23 (Begründung jeweils in
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)). Der Altbestand ist zu: A11y, PWA, Performance,
Datenschutz, Recht, Marketing und der Kleinkram-Block; F6 ist seit 2026-08-21 vollständig durch
(Worker **und** Rückmeldung). Belegstellen in [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md).

### 1.0 OCR-Belegerkennung als Browser-OCR · `neu`

**Entschieden 2026-08-23: wird gebaut.** Die letzte Feature-Lücke gegen sevDesk und lexoffice.
Ausschließlich als **Browser-OCR (Tesseract.js)** — der Beleg verlässt das Gerät nie, das ist der
Punkt der Übung. **Keine Server-OCR, auch nicht als Fallback.**

Spezifikation inkl. der nötigen CSP-Freigabe liegt fertig vor:
[`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md) (`9567630`).

> **Vor dem Start klären:** Tesseract.js ist eine **neue Abhängigkeit** — nach Projektregel 6
> nicht ohne Rückfrage. Bezugsweg und Prüfsumme wie bei SheetJS behandeln: lokal nach
> `js/vendor/` mit SHA-256 in `VERSIONS.md`, **nie** über npm nachziehen.

Aufwand: mehrere Sitzungen. Erst nach den Live-Tests aus 2.3 sinnvoll — ein neues Feature auf
ungetestetem Fundament ist die teurere Reihenfolge.

### 1.0b Landing-Demo ausbauen · `index.html`, Abschnitt `#demo`

**Entschieden 2026-08-23** als der Weg, die Einstiegshürde zu senken — statt Kartenpflicht
abzuschaffen oder einen Read-only-Tier zu bauen.

Die Demo existiert und ist echt (Dashboard, Buchungen, EÜR, GoBD-Protokoll, „kein Video und keine
Animation"). Ausbaurichtung: mehr Module zeigen, eigene Zahlen eingebbar machen, den Sprung von
der Demo in den Checkout an der Stelle anbieten, an der der Wert sichtbar wurde.

**Nicht anfassen:** Gate-Logik und Rechtstexte. Der Reiz dieses Wegs ist gerade, dass er beides
unberührt lässt.

> ⚠️ `index.html` wird häufig von parallelen Sessions gehalten — vorher `git status` prüfen.

### 1.1 F6 — Krypto-Worker · ✅ erledigt 2026-08-21

Gebaut in `185b354` (Worker + 13 Prüfungen), **verdrahtet in `39cf8b1`**. `_encrypt` und
`_decryptCt` in [`js/cloud-sync.js`](../js/cloud-sync.js) laufen über
[`js/crypto-worker.js`](../js/crypto-worker.js), mit Inline-Fallback wenn kein `Worker` verfügbar ist.

> **Die Erfolgsprognose war zu optimistisch.** Angekündigt waren 62 % weniger Blockade, gemessen
> durch die fertige Funktion sind es **rund 38 %** (150 ms → 92,5 ms bei 10,27 MB Klartext). Die
> alte Zahl mass die Krypto-Kette allein; `JSON.stringify` (35,9 ms) und der Klon zum Worker
> (4,3 ms) bleiben zwangsläufig im Main-Thread. Vollständige Herleitung inkl. der nicht sauber
> zugeordneten Restzeit: [`f6-worker-einbau-2026-08-18.md`](f6-worker-einbau-2026-08-18.md).
>
> Der Gewinn liegt weniger in der Summe als darin, **dass der Thread überhaupt wieder
> zwischendurch drankommt** — 7 statt 1 Herzschlag. Ein Dauerfreeze von 150 ms ist für den
> Nutzer etwas anderes als zwei kürzere Blöcke.

### 1.2 F6, zweite Hälfte — Sync-Rückmeldung · ✅ erledigt 2026-08-21 (`617bfc3`)

Die Ursache war enger als die Aufgabe vermuten ließ: `_setDot` benutzte für `sync` und `ok`
**dasselbe Icon in derselben Farbe** — der einzige Unterschied stand im `title`-Attribut und war
damit nur beim Hovern zu sehen. Es fehlte also kein Detail, sondern überhaupt ein sichtbarer
Unterschied.

Jetzt: eigenes Icon (`ti-refresh`) plus Drehung während des Laufs, und der Tooltip führt den
Fortschritt mit — erst `(Stammdaten)`, dann pro Firma `(Muster GmbH, 2 von 3)`.
Read-only-Mandanten der Steuerberater-Ansicht zählen nicht mit.

> **Warum der Icon-Wechsel und nicht nur die Animation:** `css/style.css` hat eine globale
> `prefers-reduced-motion`-Regel, die jede Animation stillstellt. Der Icon-Wechsel trägt deshalb
> die Information, die Drehung ist nur die Zugabe.

Zwei neue Prüfungen in `test/test-cloud-sync.js` (jetzt 12) nageln die **Eigenschaft** fest —
`sync` und `ok` dürfen nicht dasselbe Icon benutzen; *welches* Icon es ist, darf sich ändern.
Bewusst anders gebaut als der alte R7-Test, der einen Wortlaut festhielt und beim nächsten Umbau
falsch alarmiert hat. Gegenprobe gemacht: mit dem alten Icon schlägt der Test an.

**Damit ist Abschnitt 1 leer.** Was bleibt, steht in Abschnitt 2 und 3 — und braucht dich oder
Dritte, nicht eine weitere Session.

---

## 2. Braucht dich — keine Session kann das allein

### 2.1 Eine ENV-Variable, die eine Sicherheitslücke offen lässt 🟠

**Das Wichtigste auf dieser Seite. 10 Minuten, reine Konfiguration, kein Code.**

Der Code-Fix zu **R3** ist drin: `api/sync.js`, `api/blob-upload.js` und `api/whop-access.js`
bevorzugen `SYNC_OWNER_IDS` / `WHOP_OWNER_IDS` (unveränderliche Whop-User-IDs, `user_…`).

**Aber:** Solange diese Variablen in Vercel leer sind, greift der Altweg — der Vergleich gegen
den bei Whop **frei änderbaren Benutzernamen**, mit dem hart kodierten Default
`'secondlifevintage41'`. **Wer sich diesen Namen bei Whop gibt, bekommt Owner-Rechte ohne Abo.**

→ In Vercel `SYNC_OWNER_IDS` und `WHOP_OWNER_IDS` auf die echte Whop-User-ID setzen, danach die
alten `*_OWNER_USERNAMES` löschen.

### 2.2 Zwei Whop-Mails konfigurieren (N4)

Reine Backend-Konfiguration, kein Code, ~1 h:

- **3 Tage vor der Jahresverlängerung** — 135 € ohne Vorwarnung ist die Buchung, die zu
  Rückfragen und Rückbuchungen führt.
- **7 Tage nach der Kündigung**, mit dem Hinweis dass die Daten erhalten bleiben. Der
  Winback-Screen in der App ist gut gemacht, erreicht aber nur Rückkehrer.

### 2.3 Live-Tests — brauchen echte Logins

Gebaut und committet, aber nie unter echten Bedingungen gelaufen:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen)
- **StB-Zugang mit zwei Accounts** inkl. Fingerabdruck-Abgleich
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen
- **Excel-Import mit einer echten Datei** (Buchungen + Lager)
- **Edge-Tastaturtest der Gate-Overlays** — die Logik ist geprüft, die Wahrnehmung nicht
- **Lager-Feature-Batch Punkt 10** — Live-Durchklick

> **Wichtig:** Claude loggt sich **nicht** selbst bei Whop ein. Wenn ein Test einen Login
> braucht, meldest du dich einmal im Browser-Pane an; die Session bleibt danach erhalten. Ein
> Dev-Bypass im Code ist ausdrücklich nicht gewünscht.

### 2.4 Produktentscheidungen · ✅ alle getroffen (2026-08-23)

**Hier steht nichts mehr offen.** Alle sieben Fragen sind entschieden und in
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) mit Begründung festgehalten:

| Frage | Entscheidung | Folge |
|---|---|---|
| Modulzahl | **28** | steht viermal korrekt auf der Landing (`065f95c`) |
| Preisstaffel | **ein Preis, keine Staffel** | — |
| Zielgruppe | **EÜR-Rechtsformen vorn** (Einzelunternehmen, Freiberufler, GbR, eGbR) | — |
| Zeiterfassung | **wird nicht gebaut** | eigenes Produktfeld |
| Top-of-Funnel | **Demo ausbauen**, Kartenpflicht bleibt | → Aufgabe 1.0b |
| Steuerberater-Modell | **bleibt kostenlos**, als Vertriebskanal | nichts zu bauen — der R4-Deckel ist längst drin (`MAX_GRANTS`, [`api/sync.js:499`](../api/sync.js)) |
| OCR | **wird gebaut**, als Browser-OCR | → Aufgabe 1.0 |

---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe** — AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel. Der
  AGB-Text weist auf Letzteres **selbst** hin; das ist ehrlich, sollte vor dem Launch aber durch
  die echte Prüfung ersetzt werden. Eine Widerrufsklausel, die nicht trägt, ist bei einem
  Trial-Modell der teuerste Fehler.
- **AV-Verträge nach Art. 28 DSGVO** — Whop ist bekannt offen. **Zusätzlich prüfen: Upstash und
  Vercel**, beide sind in `datenschutz.html` als Auftragsverarbeiter benannt.
- **§25a, ermäßigter Satz von 7 %** — die Marge wird pauschal mit 19 % gerechnet. Bei Kunst,
  Sammlerstücken und Antiquitäten kann nach §25a Abs. 3 UStG i. V. m. Anlage 2 Nr. 49–53 der
  ermäßigte Satz gelten. Der Fehler geht Richtung **Überzahlung**, ist also steuerstrafrechtlich
  ungefährlich. Braucht eine Rechtsrecherche, welche Warenart im Einzelfall wirklich 7 % ist —
  **nicht blind implementieren.**

---

## Reihenfolge, wenn du wenig Zeit hast

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | **2.1 ENV-Variablen in Vercel** | Einzige offene Sicherheitslücke, reine Konfiguration | 10 Min |
| 2 | **2.2 Whop-Mails** | Verhindert Rückbuchungen bei der 135-€-Verlängerung | 1 h |
| 3 | **2.3 Live-Tests** | Sechs Funktionen sind gebaut, aber nie unter echten Bedingungen gelaufen | mehrere Sitzungen |
| 4 | **1.0b Landing-Demo ausbauen** | Der gewählte Weg gegen die Einstiegshürde; rührt Gate und Rechtstexte nicht an | mittel |
| 5 | **1.0 OCR (Browser-OCR)** | Letzte Feature-Lücke — aber erst **nach** den Live-Tests, und die neue Abhängigkeit vorher freigeben lassen | mehrere Sitzungen |

Rang 1–3 hängen ausschließlich an dir. Erst danach lohnt sich Bauen: ein neues Feature auf
ungetestetem Fundament ist die teurere Reihenfolge.
