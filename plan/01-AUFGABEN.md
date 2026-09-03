# Was noch zu tun ist

**Stand: 2026-08-25**, jeder Punkt an diesem Tag gegen den Code verifiziert — nicht aus einer
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

**Offen ist noch 1.5** (Stand 2026-09-03). Die Funde 1.3 und 1.4 aus Live-Test 5 sind gefixt
(`dddea9d`, gepusht und auf Produktion gegengeprüft) und stehen unten als ✅ — mit dem, was sich
beim Bauen gegenüber der ursprünglichen Fundbeschreibung als falsch herausgestellt hat.

### 1.3 Doppelte Artikelnummer beim **Anlegen** · ✅ erledigt 2026-09-03 (`dddea9d`)

Von den vier Schreibwegen prüften zwei nicht:

| Weg | vorher | jetzt |
|---|---|---|
| Bearbeiten-Maske ([`js/lager.js:2681`](../js/lager.js)) | Toast + Abbruch — war schon richtig | unverändert |
| Neuer Artikel ([`lager/page.js`](../lager/page.js)) | **Dublette entstand** | Toast, Fokus zurück ins Feld, nichts geschrieben |
| Bulk-Einkauf ([`lager/page.js`](../lager/page.js)) | **Dublette entstand** | prüft gegen Bestand **und** die Zeilen gegeneinander |
| Excel-Import ([`lager/page.js`](../lager/page.js)) | Suffix `-2`/`-3` | unverändert — dort ist Umbenennen richtig |

`savePurchase` fängt Duplikate nur im Edit-Zweig ab; sein Neu-Zweig generiert eine Nummer **nur
bei leerem Feld** und ließ eine ausgefüllte, bereits vergebene durch. Die Prüfung sitzt jetzt in
der UI, vor dem Sperren des Speichern-Buttons — bei einem Treffer wird nichts geschrieben.

**Warum das nicht kosmetisch war:** der Verkäufe-Import ordnet über die Nummer zu und baut dafür
`artNrMap[nr] = p` — bei einer Dublette **gewinnt der zuletzt angelegte**. Der Verkauf hing dann
am falschen Einkaufspreis, was §25a-Marge und EÜR verfälscht.

Gegenprobe am 2026-09-03 auf Produktion, in der Firma „Test":

```
Duplikat SV-1042      -> 7 Artikel vorher, 7 nachher, Toast „bereits vergeben", Fokus im Feld
freie Nummer          -> 7 vorher, 8 nachher, Dialog schließt normal
```

`test/test-artikelnummer-eigene.js` von 23 auf 32 Checks erweitert (Abschnitt D), inklusive
Quelltext-Prüfung, damit ein späterer Umbau die Prüfstellen nicht still entfernt.

> **Korrektur an der ursprünglichen Fundmeldung vom 2026-09-01.** Dort stand,
> `isArtikelNrTaken()` werde „repo-weit an genau einer Stelle" aufgerufen und die
> Bearbeiten-Maske lehne **stumm** ab. Beides war falsch: die Suche hatte `js/lager.js` nicht
> erfasst. Der Bearbeiten-Dialog hat die Vorab-Prüfung mit Fehlermeldung seit je, und der
> Kommentar in [`js/store.js`](../js/store.js), der auf sie verweist, stimmt — er wurde
> **nicht** geändert. Der eigentliche Fund (die beiden Anlege-Wege) bestand unabhängig davon.

### 1.4 §25a: Retouren-Korrektur verpuffte in der Standardmethode · ✅ erledigt 2026-09-03 (`dddea9d`)

`margeEinzeldifferenz()` las nur `verkaufspreis`/`einkaufspreis`. Die `margeKorrektur`, die
[`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) für Retoure und Gutschrift nach §17 UStG
erzeugt, trug damit `max(0, 0−0) = 0` bei und verschwand: nach einer vollen Retoure blieb die
ursprünglich versteuerte Marge in Kz. 81 stehen, obwohl der Kunde sein Geld zurück hatte —
**Übersteuerung**. Nur die Standardmethode war betroffen; die Gesamtdifferenz summiert flach und
rechnete richtig.

Die Korrektur wird jetzt über einen gemeinsamen Schlüssel — die verknüpften Lagerartikel — gegen
genau die Position verrechnet, zu der sie gehört, und zwar **vor** dem Floor. Der Floor bei 0
wirkt unverändert **pro Position**: eine überschießende Retoure drückt die Marge einer anderen
Position nicht, §25a Abs. 3 bleibt gewahrt.

Gegenprobe gegen die **ausgelieferte** Datei (`curl` auf Produktion, nicht der Working Tree):

```
nur Verkauf     : margeBrutto 50,00  ust 7,98
+ volle Retoure : margeBrutto  0,00  ust 0,00
+ halbe Retoure : margeBrutto 25,00  ust 3,99
```

**Zweiter Fehler in derselben Ecke, mitgefixt:** bei Gesamtdifferenz landete die Korrektur eines
Artikels über 750 € im Gesamttopf, in dem der Artikel selbst gar nicht steckt. Das senkte die
Gesamtdifferenz zu Unrecht **und** ließ den Artikel seine volle Marge behalten. Korrekturen
folgen jetzt ihrer Position in den richtigen Topf.

`test/test-25a-retoure-marge.js` ist neu (13 Checks) — es gab bis dahin keinen §25a-Harness.

> **Bleibende Grenze, kein Fehler:** findet eine Korrektur in der Periode keine passende Position
> (Verkauf in Q1, Retoure in Q2), läuft sie gegen 0 und bleibt wirkungslos. Die Einzeldifferenz
> kennt anders als die Gesamtdifferenz keinen Vortrag (§25a Abs. 4 UStG), in den ein
> Negativbetrag wandern könnte. Im Code kommentiert.

> **Zur Einordnung im Session-Prompt.** [`session-prompt-live-test-5-lager-2026-08-30.md`](session-prompt-live-test-5-lager-2026-08-30.md)
> führte den Punkt als „bekannte, bewusste Grenze — kein Fund" und verwies auf
> [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). Der Verweis ging ins Leere: einen §25a-Eintrag
> gab es dort am 2026-09-01 nicht — der [heutige](02-ENTSCHEIDUNGEN.md) stammt aus einer anderen
> Session und behandelt den **Steuersatz**, nicht die Korrektur. Der Floor verbietet Verrechnung
> **zwischen** Positionen; hier wurde dieselbe Position nach §17 UStG zurückgenommen.

### 1.5 Abgebrochene Rechnung lässt Lagerartikel als „verkauft" zurück

**Live gemessen am 2026-09-01** auf Produktion, Firma „Test", beim Durchklicken von Live-Test 5,
Punkt 2. Der eigentliche Prüfpunkt ist dabei **bestanden**: „📦 Artikel aus Lager" markiert den
Artikel sofort beim Verknüpfen als verkauft, nicht erst bei der Zahlung, und der Gegenweg trägt
auch — Position wieder entfernen setzt ihn auf `verfuegbar` zurück und leert `verkaufsdatum`.

**Der Fund liegt daneben:** verlässt man die Rechnung, **ohne** die Position zu entfernen und
**ohne** zu speichern, bleibt die Markierung stehen. Gemessen nach dem Weg-Navigieren:

```
status:        verkauft
verkaufsdatum: 2026-09-01
Rechnungen:    0
Verkäufe:      0
```

Der Artikel ist damit aus dem Bestand verschwunden — er zählt nicht mehr unter „Verfügbar" und
nicht mehr im Lagerwert —, **ohne dass ihm ein Umsatz gegenübersteht**. In der EÜR fehlt die
Einnahme, im Lager fehlt die Ware. Wer es nicht zufällig bemerkt, findet den Artikel nur über
den Status-Filter wieder und muss ihn von Hand zurücksetzen.

> **Warum das kein Randfall ist:** die §14-Sperre macht ihn wahrscheinlich. Ohne Steuernummer
> lässt sich die Rechnung **gar nicht** speichern (der Hinweis steht korrekt oben im Formular).
> Ein neuer Nutzer, der eine Rechnung ausprobiert, bevor er seine Stammdaten gepflegt hat,
> läuft also zwangsläufig in genau diesen Pfad: er kann nicht speichern, verlässt das Formular —
> und hat still einen Artikel weniger im Lager. Die beiden Mechanismen sind je für sich richtig
> und ergeben zusammen den Fehler.

**Betroffen ist in den Testdaten:** `CC-P2-1` („Session-CC Punkt2"), bewusst **nicht**
zurückgesetzt, damit der Zustand nachvollziehbar bleibt.

**Lösungsrichtung** (nicht gebaut): die Markierung erst beim Speichern der Rechnung festschreiben
und beim Verknüpfen nur reservieren — dafür gibt es den Status `reserviert` bereits. Alternativ
beim Verlassen eines ungespeicherten Formulars die Markierungen zurücknehmen. Die erste Variante
ist die ehrlichere, weil sie auch den Absturz- und Tab-schließen-Fall abdeckt.

### 1.0 OCR-Belegerkennung · ✅ erledigt 2026-08-27

Gebaut nach [`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md) und
[`session-prompt-ocr-2026-08-27.md`](session-prompt-ocr-2026-08-27.md). Ergebnis, Abweichungen
und Messwerte in [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md).

Kurzfassung: `tesseract.js` 7.0.0 + `tesseract.js-core` **7.0.0** in `js/vendor/` (SHA-256 in
[`VERSIONS.md`](../js/vendor/VERSIONS.md)), Extraktionsheuristik in
[`js/beleg-ocr.js`](../js/beleg-ocr.js) mit 35 Prüfungen in
[`test/test-beleg-ocr.js`](../test/test-beleg-ocr.js), UI im Eigenbeleg-Formular.

**Drei Abweichungen von der Spezifikation, jede am Build gemessen:**

| | |
|---|---|
| **Keine CSP gelockert** | `'wasm-unsafe-eval'` war freigegeben, wird aber **nicht gebraucht**: der WASM-Kern kompiliert im Worker, dessen Antwort keine CSP trägt. Hängt an `workerBlobURL: false` — ein `blob:`-Worker erbt die Dokument-CSP. `vercel.json` und die `<meta>`-Tags sind unverändert |
| **Kern-Version 7.0.0, nicht 6.1.2** | `tesseract.js@7.0.0` verlangt `tesseract.js-core@^7.0.0`. Der `latest`-Tag von `tesseract.js-core` zeigt irreführend auf 6.1.2 |
| **Fünf Dateien statt vier** | `tesseract.min.js` (die Bibliothek selbst) fehlte in der Liste der Spezifikation, die nur die drei zur Laufzeit nachgeladenen Teile nannte |

> ⛔ **OCR wird auf der Landingpage nicht beworben** (2026-08-27) — `index.html` ist unberührt
> geblieben. Erst wenn an echten Belegen eine Trefferquote gemessen ist, die man hinschreiben
> kann. Begründung in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).

> ⚠️ **Offen: an echten Belegen messen.** Geprüft wurde bisher nur an synthetischen Bonbildern
> (sauber und absichtlich verschlechtert), dort je 3 von 3 Feldern korrekt. Ein echtes Bonfoto —
> Thermopapier, geknickt, verblasst — ist damit **nicht** abgedeckt. Genau diese Messung ist die
> Bedingung dafür, das Feature überhaupt bewerben zu dürfen.

### 1.0b Landing-Demo ausbauen · ✅ erledigt 2026-08-25 (`69361f1`, `b6be27c`, `cb95d40`)

Entschieden 2026-08-23 als der Weg, die Einstiegshürde zu senken — statt Kartenpflicht
abzuschaffen oder einen Read-only-Tier zu bauen. **Alle drei Ausbaurichtungen sind umgesetzt:**

| Ziel | Umsetzung |
|---|---|
| mehr Bereiche zeigen | fünf Reiter statt drei — Dashboard · Buchungen · **Rechnung** · EÜR · GoBD-Protokoll |
| eigene Zahlen eingebbar | `.demo-custom` mit Bezeichnung, Betrag, Typ und Kategorie → `window.demoAddCustom()` |
| Sprung in den Checkout dort, wo der Wert sichtbar wird | `#demoCtaDash` und `#demoCtaEuer` |

Gate-Logik und Rechtstexte blieben unberührt, wie es die Entscheidung verlangt.

> **Am 2026-08-25 auf Port 4324 durchgeklickt** (frischer Port, Cache-Falle umgangen), Konsole
> fehlerfrei. Die ganze Kette trägt: eigene Ausgabe „249,90 €" erscheint oben in der Liste,
> `demoCat` wechselt beim Umschalten auf *Ausgabe* korrekt auf Wareneinkauf/Porto/Bürobedarf,
> der **Wareneinsatz in der EÜR steigt auf 3.389,90 €**, der Gewinn wird neu gerechnet, und das
> GoBD-Protokoll schreibt `B-2026-90 erstellt (Wareneinkauf) · CREATE` mit. `aria-selected` ist
> beim Reiterwechsel sauber exklusiv.
>
> Das überzählige `</div>` aus `cb95d40` ist wirklich weg — `#demoList` liegt wieder innerhalb
> von `#demo`.

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

**Damit war Abschnitt 1 am 2026-08-25 leer** — OCR kam am 2026-08-27 noch einmal hinein und
ist am selben Tag fertig geworden (1.0 oben). Alles andere bleibt zu; was offen ist, steht in
Abschnitt 2 und 3 und braucht dich oder Dritte.

---

## 2. Braucht dich — keine Session kann das allein

### 2.1 ~~Owner-ENV-Variablen~~ · ✅ erledigt 2026-08-23

**Fund R3 ist geschlossen.** In Vercel gesetzt (Production + Preview, Typ Config):

| Name | Wert |
|---|---|
| `SYNC_OWNER_IDS` | `user_ljp5xcrqojylg` |
| `WHOP_OWNER_IDS` | `user_ljp5xcrqojylg` |

Redeploy ausgeführt, `/api/whop-access` antwortet danach sauber. Anleitung und Rückweg:
[`r3-owner-ids-anleitung.md`](r3-owner-ids-anleitung.md).

> **Zwei Dinge, die diese Aufgabenbeschreibung falsch hatte:**
> 1. Es waren **keine** `*_OWNER_USERNAMES` in Vercel gesetzt — der Owner-Check lief
>    vollständig über den hart kodierten Namen. Der Schritt „alte Namensvariablen löschen"
>    entfiel deshalb ersatzlos.
> 2. Das Löschen der Namensvariablen hätte die Lücke **nicht** geschlossen: der Default
>    stand im Quelltext, nicht in der Variablen. Ohne Variable griff er erst recht.

**Der Default ist mit `c413228` entfernt** (`|| ''` statt `|| 'secondlifevintage41'` in allen
drei Endpunkten), `CLOUD-SYNC.md` nachgezogen — sie dokumentierte nur den Altweg und hätte ein
Neuaufsetzen dorthin zurückgeführt.

> ⚠️ **Folge, die man kennen muss:** Der Namensweg fällt jetzt auf eine leere Liste zurück.
> Ein neues Projekt oder eine neue Umgebung ohne diese Variablen hat **keinen Owner-Bypass**.
> Das ist die Absicht — fällt aber erst beim Anmelden auf.

**Noch offen:** der funktionale Beweis. Nach dem nächsten Login muss `/api/whop-access` mit
`"owner": true` antworten. Kommt stattdessen der „Stackr Pro aktivieren"-Bildschirm, stimmt
die ID nicht — sie steht dort unten als Freigabe-Code zum Kopieren.

---
### 2.2 Zwei Whop-Mails konfigurieren (N4)

**Beide Texte sind fertig entworfen: [`whop-mails-entwuerfe.md`](whop-mails-entwuerfe.md)** —
inklusive Auslöser, Platzhaltern und dem Grund, warum in der Winback-Mail bewusst **kein Rabatt**
steht (§7 Abs. 3 UWG). Einfügen musst du sie selbst, reine Backend-Konfiguration, ~1 h:

- **3 Tage vor der Jahresverlängerung** — 135 € ohne Vorwarnung ist die Buchung, die zu
  Rückfragen und Rückbuchungen führt.
- **7 Tage nach der Kündigung**, mit dem Hinweis dass die Daten erhalten bleiben. Der
  Winback-Screen in der App ist gut gemacht, erreicht aber nur Rückkehrer.

### 2.3 Live-Tests — brauchen echte Logins

**Als durchklickbare Checkliste für eine Sitzung aufbereitet:
[`live-tests-checkliste.md`](live-tests-checkliste.md)** — mit Reihenfolge, erwartetem Ergebnis je
Schritt und dem, was sich in derselben Sitzung miterledigen lässt.

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
| Modulzahl | **29 Bereiche** | an allen vier Stellen der Landing (`7635b2f`); loest zugleich die Verwechslung mit den 9 Akademie-Modulen |
| Preisstaffel | **ein Preis, keine Staffel** | — |
| Zielgruppe | **EÜR-Rechtsformen vorn** (Einzelunternehmen, Freiberufler, GbR, eGbR) | — |
| Zeiterfassung | **wird nicht gebaut** | eigenes Produktfeld |
| Top-of-Funnel | **Demo ausbauen**, Kartenpflicht bleibt | → Aufgabe 1.0b |
| Steuerberater-Modell | **bleibt kostenlos**, als Vertriebskanal | nichts zu bauen — der R4-Deckel ist längst drin (`MAX_GRANTS`, [`api/sync.js:499`](../api/sync.js)) |
| OCR | **gebaut** als Browser-OCR, 2026-08-27. Nicht beworben, bis eine Trefferquote an echten Belegen gemessen ist | → Aufgabe 1.0, erledigt |

---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe** — AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel. Der
  AGB-Text weist auf Letzteres **selbst** hin; das ist ehrlich, sollte vor dem Launch aber durch
  die echte Prüfung ersetzt werden. Eine Widerrufsklausel, die nicht trägt, ist bei einem
  Trial-Modell der teuerste Fehler.
- **AV-Verträge nach Art. 28 DSGVO** — Whop ist bekannt offen. **Zusätzlich prüfen: Upstash und
  Vercel**, beide sind in `datenschutz.html` als Auftragsverarbeiter benannt.
- **§25a, ermäßigter Satz von 7 % — ERLEDIGT am 2026-09-03, es gibt die Frage nicht.**
  §25a Abs. 5 Satz 1 UStG schreibt für die Marge den **allgemeinen** Steuersatz vor; die 7 % auf
  Kunst und Sammlungsstücke gelten nur in der Regelbesteuerung. Die festen 19 im Code sind
  richtig. Die Recherche vom 2026-08-16 hatte Abs. 5 **Satz 2** zitiert, der Steuerbefreiungen
  regelt — hätte man sie umgesetzt, wäre daraus eine systematische **Unterzahlung** geworden.
  Begründung und die zwei Restpunkte (Pauschalmarge 30 %, Rechnungs-Pflichtangabe) stehen in
  [`25a-ermaessigter-satz-recherche.md`](25a-ermaessigter-satz-recherche.md), die Entscheidung in
  [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). **Nicht erneut als Fund melden.**

---

## Reihenfolge, wenn du wenig Zeit hast

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | **2.1 ENV-Variablen in Vercel** | Einzige offene Sicherheitslücke, reine Konfiguration | 10 Min |
| 2 | **2.2 Whop-Mails** | Verhindert Rückbuchungen bei der 135-€-Verlängerung | 1 h |
| 3 | **2.3 Live-Tests** | Sechs Funktionen sind gebaut, aber nie unter echten Bedingungen gelaufen | mehrere Sitzungen |

**Abschnitt 1 ist leer.** Es gibt derzeit keine Code-Aufgabe, die eine Session greifen könnte:
1.0b ist am 2026-08-25 fertig geworden, 1.0 (OCR) am 2026-08-27, F6 ist seit 2026-08-21 durch.
Offen ist dort nur noch eine Messung an echten Belegen — die braucht Bonfotos und damit dich.

Rang 1–3 hängen damit **ausschließlich an dir**. Für Rang 1 liegt seit `327112b` eine
Schritt-für-Schritt-Anleitung bereit: [`r3-owner-ids-anleitung.md`](r3-owner-ids-anleitung.md),
inklusive des Falls, dass man sich als Owner aussperrt.
