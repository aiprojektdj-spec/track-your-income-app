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

> ⚠️ **Diese Liste veraltet binnen Stunden.** Am 2026-08-15 waren von sechs frisch eingetragenen
> „offenen" Punkten zwei Stunden später vier bereits gebaut — von parallelen Sessions, im selben
> Working Tree. **Immer erst gegen den Code prüfen, dann greifen** — auch bei einer Liste mit dem
> heutigen Datum, auch bei dieser hier.

---

## 1. Code — kann jede Session machen

Der Abschnitt ist fast leer. A11y, PWA, Performance (bis auf F6), Datenschutz und der komplette
Kleinkram-Block sind zu.

### 1.1 F6 — Cloud-Sync-Krypto in einen Web Worker · `js/cloud-sync.js`

Der einzige verbliebene Posten mit echtem Aufwand. Verifiziert 2026-08-16: **kein `Worker` in
der Datei**, AES-GCM läuft weiterhin im Main-Thread, und der komplette Blob wird bei jedem Sync
übertragen.

Das ist die einzige Stelle, die mit dem Produkt aus *Änderungshäufigkeit × Gesamtbestand* wächst
— bei kleinen Beständen unauffällig, bei einem Reseller mit Jahren an Lagerdaten spürbar.

**Keinen Delta-Sync bauen** — Begründung in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).
Stattdessen Ver-/Entschlüsselung in einen Worker auslagern und sichtbare Rückmeldung geben; der
Nutzer sieht heute nicht, dass überhaupt etwas läuft.

Aufwand: ~2–3 h.

> ⛔ **Am 2026-08-16 nicht angefasst, weil die Datei gehalten wurde.** `js/cloud-sync.js` hatte an
> dem Tag ~91 uncommittete Zeilen einer parallelen Session (Registry-Abgleich vor dem Sync,
> `_refreshSwitcher`) — genau in den Funktionen, die der Worker-Umbau anfasst. **Vor dem Start
> `git status -- js/cloud-sync.js` prüfen**; ist die Datei nicht sauber, erst abstimmen.

### 1.2 M2 — Sozialbeweis auf der Landingpage · `index.html`

Es gibt **keinen**: keine Stimmen, keine Zahlen, keine Siegel. Bei einem unbekannten Anbieter,
dem man die Buchhaltung anvertrauen soll, ist das die stillste Kaufbremse.

**Nichts erfinden** — diese Zielgruppe prüft nach, und §5 UWG. Belastbar ist heute:

| Aussage | Beleg (2026-08-16 ausgezählt) |
|---|---|
| „über 200 automatisierte Prüfungen" | **215** `ok(`-Aufrufe in **33** Harnesses unter `test/` |
| „Ende-zu-Ende verschlüsselt" | `js/cloud-sync.js` — der Schlüssel verlässt das Gerät nie |
| „läuft offline weiter" | Offline-Grace in [`js/whop-auth.js`](../js/whop-auth.js) |

> 🔴 **Vorher zu klären — die Seite verkauft sich womöglich unter Wert:** Die Landingpage sagt an
> drei Stellen **„12 Module"** ([`index.html:152`](../index.html), `:327`, `:575`). Audit 03
> (Feature-Gap) kam ausdrücklich auf **„28 Module, nicht 12"** — siehe
> [`00-STAND.md`](00-STAND.md), Zeile 55: Bank-Import, E-Rechnung, DATEV und Mahnwesen existieren
> alle, tauchen in der 12er-Zählung aber nicht auf.
>
> `app.html` hat 17 `data-page`-Einträge in der Sidebar, dazu die vier Sub-Apps (Lager,
> Rechnungen, Eigenbelege, Finanzen) und die Akademie. **Keine der beiden Zahlen ist direkt aus
> dem Code ableitbar** — es ist eine Definitionsfrage, was als „Modul" zählt. Festlegen (siehe
> 2.4), dann **überall gleichzeitig** durchziehen. Bis dahin die Modulzahl nicht als Sozialbeweis
> verwenden — aber es ist gut möglich, dass hier Verkaufsargument verschenkt wird.

### 1.3 M4 — Wettbewerbs-Preisanker · `index.html`

Der vorhandene Anker („eine Steuerberater-Stunde kostet 150–250 €") ist gut, aber indirekt.
[`index.html:468`](../index.html) hat bereits eine Vergleichstabelle mit sevDesk als Spaltenkopf
— **aber keine Preise darin**.

Geplant war: *sevDesk 9,90 € nur für Rechnungen, 17,90 € für die Buchhaltung · Lexware Office:
E-Rechnung erst ab 32,90 € · **Stackr: 15 €. Alles.***

> **Blockiert, bis die Preise belegt sind.** Ein konkreter Wettbewerbspreis ohne Beleg und ohne
> Stichtag ist §5/§6 UWG (irreführende bzw. unzulässige vergleichende Werbung). Aus genau dem
> Grund ist derselbe Lexware-Halbsatz schon aus M1 herausgenommen worden. Wer das baut,
> recherchiert die Preise am selben Tag, schreibt **„Stand: TT.MM.JJJJ"** daneben und legt einen
> Beleg ab.

### 1.4 U7 — Leerzustände, Rest · app-weit

**Vier weitere erledigt am 2026-08-16** (`20c5d48`), browserverifiziert: AfA (mit Button „Erste
Anlage erfassen"), Lohnsteuer, Verkäufe-Liste, Material-Einkäufe. Zusammen mit
[`js/buchungen.js:978`](../js/buchungen.js) sind damit die Module abgedeckt, in denen ein
Erstnutzer tatsächlich landet.

**Was bewusst nicht angefasst wurde** — beim nächsten Durchgang nicht erneut als Fund melden:
abgeleitete Ansichten (Bilanz, Steuerberater-Export) haben keine anbietbare Handlung, und ein
leeres GoBD-Protokoll (`js/protokoll.js`) ist kein Mangel.

Offen bleiben die selteneren Module (GbR-Teilansichten, Lager-Zonen, OSS) — dort lohnt ein
Durchgang erst, wenn jemand sie im Leerzustand wirklich sieht.

Nicht zu verwechseln mit [`js/bank-import.js:443`](../js/bank-import.js) — dort ist „Keine
Buchungen **gefunden**" **korrekt**, weil es tatsächlich ein leeres Filterergebnis beschreibt.
Die Unterscheidung ist der eigentliche Fund: *leerer Bestand* braucht eine andere Ansprache als
*leeres Suchergebnis*.

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
| **Modulzahl festlegen** 🔴 | Blockiert M2. „12" steht dreimal auf der Seite, „28" im Audit, 17 `data-page` im Code. Eine Zahl festlegen und überall durchziehen |
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

## Offener Faden

**M1 liegt uncommittet in `index.html`.** Die zwei Blöcke (E-Rechnung-Zeile unter „Ein Preis.
Alles drin." und FAQ Nr. 13) sind gebaut und auf Port 4322 verifiziert, aber in keinem Commit.
Sie lagen zunächst neben fremder D0/D1-Arbeit in derselben Datei; die ist inzwischen in `bc057a6`
drin, die Datei sollte also wieder frei sein. **Vor dem Committen `git status` prüfen.**

---

## Reihenfolge, wenn du wenig Zeit hast

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | **2.1 ENV-Variablen in Vercel** | Einzige offene Sicherheitslücke | 10 Min |
| 2 | **M1 committen** | Fertige, verifizierte Arbeit liegt unversioniert herum | 5 Min |
| 3 | **Modulzahl festlegen (2.4)** | Blockiert M2 — und eine womöglich falsche Zahl steht bereits dreimal auf der Seite | 15 Min |
| 4 | **M2 Sozialbeweis** | Stillste Kaufbremse; die Testzahl ist jetzt belegt | 30 Min |
| 5 | **2.2 Whop-Mails** | Verhindert Rückbuchungen bei der 135-€-Verlängerung | 1 h |
| 6 | **F6 Krypto-Worker** | Letzter echter Technikposten | 2–3 h |

M4 fehlt in dieser Tabelle bewusst — es ist blockiert, bis die Wettbewerbspreise belegt sind.
U7 ebenfalls: eigener UX-Durchgang, kein Lückenfüller.
