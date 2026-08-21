# Was noch zu tun ist

**Stand: 2026-08-16**, jeder Punkt an diesem Tag gegen den Code verifiziert — nicht aus einer
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

**Der Worker-Umbau ist durch — übrig ist nur noch die Sync-Rückmeldung.** A11y, PWA,
Datenschutz, Recht, Marketing und der komplette Kleinkram-Block sind zu; aus der
Performance-Reihe ist F6 zur Hälfte erledigt. Alles Abgeschlossene mit
Belegstellen steht in [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md).

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

**Offen geblieben ist die zweite Hälfte von F6:** die *sichtbare Rückmeldung* während des Syncs.
`_setDot` kennt weiterhin nur `sync` / `ok` / Fehler; ein Fortschritt pro Scope („Firma 2 von 3")
fehlt. Unabhängig vom Worker, klein, jederzeit greifbar — **das ist jetzt der einzige Code-Punkt
in diesem Abschnitt.**

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

### 2.4 Produktentscheidungen, die anstehen

| Frage | Hintergrund |
|---|---|
| **Modulzahl festlegen** 🔴 | „12 Module" steht **viermal** auf der Landingpage (`index.html:152`, `:288`, `:327`, `:578`), das Feature-Gap-Audit kam auf **28**, im Code stehen 17 `data-page`. M2 ist bewusst ohne diese Zahl gebaut worden — solange sie ungeklärt ist, darf sie nirgends als Beleg dienen. Möglicherweise verkauft sich die Seite unter Wert |
| **Top-of-Funnel** | Seit Local eingestellt ist, gibt es nur Landing → Checkout **mit Kartenpflicht** — die höchste Hürde im Vergleichsfeld. Empfehlung: **Demo aufwerten** statt Free-Tier bauen. Alternativen: Trial ohne Kartenpflicht, oder Read-only-Tier |
| **Zielgruppen-Schärfung** | Reseller und GbR haben eigene Module, Freelancer nur den Standard. Empfehlung: Reseller + GbR nach vorn, Freelancer ehrlich als drittes Segment |
| **Zeiterfassung für Freelancer?** | Null Treffer im Code. Empfehlung: **nicht bauen** — eigenes Produktfeld, gute Speziallösungen vorhanden; Energie in Reseller/GbR |
| **Preisstaffel?** | Ein Preis für sehr unterschiedliche Intensität. Falls gestaffelt: **nach Firmenanzahl**, nie nach Features (E-Rechnung hinter einen Tarif zu legen ist genau der Lexware-Fehler) |
| **Steuerberater-Modell** | Der StB-Zugang ist gebaut und kostenlos. Eine Kanzlei mit 40 Mandanten wäre ein eigenes Preismodell wert — zusammen mit dem Grant-Deckel (R4) angehen: erst Leck schließen, dann Preis verlangen |
| **OCR** | Die einzige verbliebene Lücke, die weder gesetzlich erzwungen noch architekturbedingt blockiert ist. Spezifikation inkl. CSP-Freigabe liegt vor (`9567630`). Als **Browser-OCR** (Tesseract.js) wäre es eine Aussage, die kein Wettbewerber machen kann |

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
| 2 | **Modulzahl festlegen (2.4)** | „12 Module" steht viermal auf der Landingpage, das Feature-Gap-Audit sagt 28 — solange das offen ist, darf die Zahl nirgends als Beleg dienen | 15 Min |
| 3 | **2.2 Whop-Mails** | Verhindert Rückbuchungen bei der 135-€-Verlängerung | 1 h |
| 4 | **F6 Krypto-Worker** | Der letzte offene Code-Punkt überhaupt | 2–3 h |
| 5 | **2.3 Live-Tests** | Sechs Funktionen sind gebaut, aber nie unter echten Bedingungen gelaufen | mehrere Sitzungen |

Danach ist Abschnitt 1 leer und das Projekt hängt nur noch an dir (Abschnitt 2) und an Dritten
(Abschnitt 3).
