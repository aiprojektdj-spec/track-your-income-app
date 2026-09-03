# Live-Tests — Checkliste für eine Sitzung

**Stand: 2026-08-30.** Aufgabe 2.3 aus [`01-AUFGABEN.md`](01-AUFGABEN.md).

> **Punkt 6 ist am 2026-08-29 abgearbeitet** — er brauchte keinen Login, weil das Gate genau
> der Zustand *ohne* Anmeldung ist. Ergebnis, Fund und Fix stehen unten bei Punkt 6.
> **Punkt 7 (Bon) ist am 2026-08-30 gemessen** — ebenfalls ohne Login, an einem echten
> Bauhaus-Bon: **2 von 3**, und der Fehltreffer ist ausgerechnet die Bruttosumme
> (`785,90` statt `85,90`). Fund, Rohtext-Befund und ein Fixvorschlag stehen unten bei Punkt 7;
> die Entscheidung über die Regeländerung steht noch aus.
> **Punkt 1 (Excel-Import) ist am 2026-09-03 gemessen** — ebenfalls ohne Login: der Import
> hängt an SheetJS, nicht am Gate. Vier Funde an einer echten Datei, zwei davon still
> (ein Tippfehler im Blattnamen und ein Toast, der eine Null verschweigt). **Fund 1, 2 und
> das Dezimalkomma sind noch am selben Tag behoben** und durch einen Harness abgesichert;
> Fund 3 und 4 bleiben als Produktentscheidungen offen. Alles unten bei Punkt 1.
> **Punkt 5 (Lager) ist am 2026-09-03 abgeschlossen** — als einziger bisher **auf Produktion**,
> weil das Gate lokal prinzipiell nicht aufgeht (Kasten unten). Drei Funde: die Duplikatprüfung
> fehlte beim **Anlegen**, und die §25a-Retoure verpuffte in der Standardmethode — beide
> inzwischen behoben (`dddea9d`) und die Korrektur an der ausgelieferten Datei nachgemessen.
> Offen bleibt Fund 1.5: eine **abgebrochene** Rechnung lässt den Lagerartikel als „verkauft"
> zurück, ohne Umsatz.
> **Die Punkte 2–4 warten weiter auf dich.**

Sieben Funktionen sind gebaut, committet und statisch geprüft, aber nie unter echten Bedingungen
gelaufen. Fünf davon brauchen einen **echten Whop-Login** — deshalb einmal anmelden und dann
alles am Stück durchgehen, statt fünfmal einzeln.

> **Ablauf:** Du meldest dich einmal im Browser-Pane bei Whop an, die Session bleibt danach
> erhalten. Claude loggt sich nicht selbst ein, und ein Dev-Bypass im Code ist nicht gewünscht.
> Ab da kann eine Session mitlesen, Konsole und Netzwerk prüfen und die Ergebnisse festhalten.

**Vorher:** frischen Port aus `.claude/launch.json` nehmen (höchster + 1) — der
`python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am Origin. Reload,
Cache-Bust und neuer Tab liefern trotzdem alten Code.

> ⚠️ **Das gilt aber nicht für die Punkte 1–5. Auf einem lokalen Port kommt man dort gar nicht
> hinein** — am 2026-09-01 am Code und im Browser belegt, und der Grund ist zweifach:
>
> 1. **Das Gate braucht `api/`.** `js/whop-auth.js` ruft `/api/whop-token` und
>    `/api/whop-access` **gleichursprünglich** auf. `python -m http.server` liefert nur
>    statische Dateien; die fünf Endpunkte in `api/` sind Vercel-Functions und existieren
>    lokal nicht. Der Zugangs-Check kann dort also nie zustande kommen.
> 2. **Die Sitzung hängt am Origin.** `localStorage` ist pro Origin getrennt, und dort liegen
>    `whop_access_token` und `whop_grace_token`. `localhost:4340` ist ein anderer Origin als
>    `localhost:4337` — **jeder frische Port ist eine frische Anmeldung**, auch wenn `api/`
>    da wäre. Gemessen: `whopLoginOverlay: SICHTBAR`, `localStorage` leer.
>
> Die beiden Sätze „frischer Port" und „die Session bleibt danach erhalten" schließen einander
> also aus. **Für die Punkte 1–5 ist die Produktionsumgebung der einzige Weg**
> (`https://track-your-income-app.vercel.app`), im normalen Browser mit der bestehenden
> Anmeldung. Der frische lokale Port bleibt richtig für alles, was **kein** Gate braucht —
> Punkt 6 und Punkt 7 sind genau so gelaufen.
>
> **Folge für das Testen auf Produktion:** dort liegen echte Buchhaltungsdaten. Vor
> schreibenden Schritten die **aktive Firma auf eine Testfirma umstellen** — es gibt eine
> namens „Test". Firmenübergreifend wirken trotzdem: Cloud-Sync-Aktivierung, die
> Art.-17-Löschung, der Webhook und die StB-Freigabe. Diese vier sind **nicht**
> firmengescoped und treffen auch die echten Daten (u. a. „Reck & Schwarz GbR").

---

## Reihenfolge — absichtlich so

Der Datentransfer steht vorn, weil alles Weitere auf vorhandenen Daten aufbaut.

### 1. Excel-Import mit einer echten Datei · ⚠️ gemessen 2026-09-03 — **4 Funde, 2 davon still**

Nimm eine echte Datei, keine erfundene — der Sinn des Tests ist gerade, dass echte Dateien
unsauberer sind.

**Gelaufen an `Umsätze.Vinted.2025.xlsx`** (die echte Datei hinter der ESt-Abgabe 2025:
15.203 / 12.188,10 / 3.014,90). Sechs Blätter — `ANLEITUNG | Einkaeufe | Verkaeufe |
Kassenbuch | EÜR | Vorlagen`, 189 Einkaufs- und 338 Verkaufszeilen.

> **Ohne Login und ohne Produktion gemessen.** Der Import hängt an SheetJS und den zwei
> Parse-Pfaden, nicht am Gate. Ein Node-Harness lädt `js/vendor/xlsx.full.min.js` und schneidet
> `_autoDetect` / `_findHeaderRow` / `_parseDate` **im Wortlaut aus `lager/page.js`** heraus
> (dynamisch gesucht, nicht nach Zeilennummer — die verschob sich während des Laufs um 32
> Zeilen durch eine Parallel-Session). Nur das Spalten-Mapping aus `js/app.js` ist
> **nachgebildet**, weil es inline in einem DOM-Handler steht und sich nicht schneiden lässt;
> die Fundstelle ist [`js/app.js:2606`](../js/app.js) ff. Harness im Scratchpad.
>
> **Was das nicht abdeckt:** den Klickweg. Dateiauswahl, Toast, Mapping-Dialog und der
> tatsächliche Schreibvorgang in den Store sind nicht durchgeklickt. Die Zahlen unten sind
> Parser-Ergebnisse, keine Store-Stände. Die 527 Datensätze absichtlich **nicht** in die
> Produktions-App geschrieben.

- [x] **Buchungen-Import: Zeilenzahl in der Datei = Zeilenzahl in der App?** ❌
      **189 Einkäufe in der Datei → 29 in der App.** 160 nicht-leere Zeilen fallen weg und
      werden als „leere Zeilen“ gemeldet. Verkäufe: 338 → **0** (Fund 1).
- [x] **Lager-Import: 3-Sheet-Template und flache Tabelle?** ❌ Beides nicht — er kommt an
      den Daten gar nicht an (Fund 4).
- [x] **Umlaute korrekt?** ✅ Sauber durch, an der echten Datei: `Weiß`, `Gebühren`, `EÜR`,
      `Umsätze` im Dateinamen. Kein Fund.
- [x] **Beträge mit deutschem Dezimalkomma (nicht Faktor 100 daneben)?** ⚠️ Kein Faktor-100-
      Fehler. Aber `parseNum` macht `String(v).replace(',', '.')` — **ein String-Argument
      ersetzt nur das erste Vorkommen**. Gemessen: `"80,50"→80.5` ✅, `"1234,56"→1234.56` ✅,
      **`"1.234,56"→1.234`** ❌ — Faktor **1000 nach unten**. In dieser Datei nicht ausgelöst,
      weil die Beträge numerische Zellen sind; erreichbar wird es über Textzellen, und genau
      die lädt die eigene Vorlage ein („Preise mit Punkt ODER Komma — beides wird erkannt“,
      [`js/app.js:2545`](../js/app.js)). `.replace(/\./g,'').replace(',','.')` wäre der Fix,
      aber nur nach Klärung, was mit `"80.50"` passieren soll.
- [x] **Ein Datum am Monatsersten und -letzten gegen die Quelle prüfen** ❌ Nicht prüfbar:
      **alle** Datumswerte kommen als **heutiges Datum** an (Fund 2).

> **Fund 1 — der Blattname `Verkaeufe` wird nie gefunden. Ein Tippfehler.**
> [`js/app.js:2634`](../js/app.js) sucht die Verkäufe so:
>
> ```js
> const wsV = wb.Sheets['Verkäufe'] || wb.Sheets['Verkauefe'] || wb.Sheets['verkauf'] || wb.Sheets['Verkauf'];
> ```
>
> `Verkäufe` ohne Umlaut heißt **`Verkaeufe`** — im Code steht **`Verkauefe`**, u und e
> vertauscht. Die Einkaufszeile direkt darüber (`:2606`) transliteriert `Einkäufe → Einkaeufe`
> **richtig**; genau diese Asymmetrie macht es zum Tippfehler und nicht zu einer Absicht.
>
> Der Haupt-Pfad ist nicht betroffen: die mitgelieferte Vorlage
> ([`js/app.js:2509`](../js/app.js)) benennt ihre Blätter **mit** Umlaut, und `'Verkäufe'`
> steht als erste Alternative da. Der ASCII-Name ist der Ausweichpfad für Dateien, die den
> Umlaut unterwegs verloren haben — und der trägt nur zur Hälfte.
>
> **Warum das schlimmer ist als ein glatter Fehlschlag:** die Einkäufe kommen an, die Verkäufe
> nicht. Eine **halbe** Übernahme sieht aus wie eine gelungene. Wer sie nicht nachzählt, führt
> eine EÜR mit Ausgaben ohne die zugehörigen Einnahmen.

> **Fund 2 — die stille Null im Abschluss-Toast.** Die Meldung wird so gebaut:
>
> ```js
> const msg = [ importedEinkauf > 0 ? `${importedEinkauf} Einkäufe` : '', … ].filter(Boolean).join(', ') || '0 Datensätze';
> ```
>
> `.filter(Boolean)` wirft eine Null **komplett heraus**, statt sie als „0 Verkäufe“
> anzuzeigen. Gemessener Toast für diese Datei:
>
> ```
> Import abgeschlossen: 29 Einkäufe (972 leere Zeilen übersprungen)
> ```
>
> Das Wort „Verkäufe“ kommt darin nicht vor. Der Nutzer erfährt nicht, dass 338 Verkäufe
> weggefallen sind — er erfährt nicht einmal, dass es um Verkäufe ging. Zusammen mit Fund 1
> ergibt das den unangenehmsten Fall: **ein grüner Haken auf einem halben Import.**
>
> Dass die Klammer „972 leere Zeilen übersprungen“ sagt, macht es schlimmer statt besser:
> **160 dieser Zeilen sind nicht leer**, sondern echte Einkäufe. Die Meldung behauptet also
> aktiv das Gegenteil des Vorgefallenen.

> **Fund 3 — die Kopfzeile wird nie geprüft.** Nach dem Blattnamen-Treffer liest der Import
> stur nach Spaltenindex (`r[0]`, `r[1]`, …) und wirft die Kopfzeile mit `rows.slice(1)` weg.
> Trifft der Blattname, passt aber die Spaltenfolge nicht, entsteht **stiller Unsinn mit
> Erfolgsmeldung**. Gemessen an dieser Datei:
>
> | Spalte in der Datei | landet in der App als |
> |---|---|
> | `Belegnummer (E-###)` (leer) | `datum` → Rückfall auf **heute** |
> | `Datum` | `marke` |
> | `Plattform / Ort` (`Vinted`) | `artikeltyp` |
> | `Artikel / Beschreibung` | `groesse` |
> | `Farbe` (`Weiß`) | `beschreibung` |
> | `Betrag (€)` | `einkaufspreis` ✅ (zufällig richtig) |
> | `Versand / Gebühren (€)` (`3,29`) | `anzahl` → `parseInt` → **3 Stück** |
> | `Zoll / EUSt (€)` (`/`) | `einkaufsquelle` → **`/`** |
>
> Ein echter Datensatz nach dem Import:
> `{"datum":"2026-09-03","marke":"","artikeltyp":"Vinted","groesse":"Adidas Trainingsjacke XL","beschreibung":"Blau","einkaufspreis":12,"anzahl":3,"einkaufsquelle":"/"}`
>
> Auch die **Abbruchbedingung** hängt an dieser Verschiebung: übersprungen wird, wenn `r[1]`
> **und** `r[4]` leer sind — in dieser Datei also „kein Datum **und** keine Farbe“. Daher die
> 160 verlorenen Einkäufe: ihnen fehlte schlicht die Farbangabe.
>
> Und die Zeilenzahl allein hätte den Fehler **nicht** gezeigt: hebt man Fund 1 auf, importiert
> das Blatt `Verkaeufe` **338 von 338** Zeilen — die Zählprobe der Checkliste steht auf „grün“,
> während die Summe der Verkaufspreise bei **0,00 €** statt 15.203 € liegt (`r[5]` zeigt auf
> `Gewinn (€)`, und die Spalte ist leer). **Die Zeilenzahl ist als Prüfkriterium zu schwach;
> es braucht eine Summenprobe.**
>
> ⚠️ **Fairness:** Diese Datei ist *nicht* Stackrs Vorlage, sondern eine eigene Vinted-Tabelle.
> „Falsche Spalten rein → Unsinn raus“ ist insofern erwartbar. Der Fund ist **nicht**, dass die
> Zuordnung danebenliegt, sondern dass niemand sie prüft: ein Abgleich der Kopfzeile gegen die
> erwarteten Namen würde hier abbrechen statt zu importieren.

> **Fund 4 — der Lager-Import nimmt immer das erste Blatt, und es gibt keine Auswahl.**
> [`lager/page.js:1865`](../lager/page.js) (und `:2359`, sowie
> [`js/buchungen.js:1640`](../js/buchungen.js)) greifen fest auf `wb.SheetNames[0]`. Bei dieser
> Datei ist das Blatt 0 die **`ANLEITUNG`**. Gemessen:
>
> ```
> genommen wird : SheetNames[0] = "ANLEITUNG"
> _findHeaderRow: 0 -> ["Anleitung (einfach erklärt)"]
> Toast         : "✅ 17 Zeilen geladen aus ANLEITUNG"
> _autoDetect   : {}   (keine einzige Spalte zugeordnet)
> ```
>
> Der Nutzer bekommt einen **grünen Erfolgs-Toast über 17 importierbare Zeilen Fließtext**,
> und der Mapping-Dialog öffnet sich mit einer einzigen Spalte und leerer Zuordnung. Der
> Blattname steht immerhin im Toast — das ist die einzige Chance, es zu merken.
>
> Beide Vorlagen der App sind mehrblättrig (die eigene hat vier Blätter). **Ein
> Blatt-Auswahlfeld fehlt**, und `_findHeaderRow` kann das nicht auffangen: es sucht die
> Kopfzeile *innerhalb* eines Blattes, nicht das richtige Blatt.

> **Nachtrag 2026-09-03 — Fund 1, 2 und das Dezimalkomma sind auf Ansage behoben.**
> Die Messkästen darüber bleiben **unverändert stehen**: sie sind der Zustand beim Lauf, nicht
> der heutige Codestand (dieselbe Regel wie bei Punkt 7).
>
> | | vorher | nachher |
> |---|---|---|
> | Verkäufe aus `Verkaeufe` | 0 von 338 | **338 von 338** |
> | Toast | `29 Einkäufe (972 leere Zeilen übersprungen)` | `29 Einkäufe, 338 Verkäufe (1627 Zeilen übersprungen)` |
> | `parseNum("1.234,56")` | `1.234` | **`1234.56`** |
>
> Die Null wird nur genannt, wenn das Blatt **da war** — ein fehlendes Blatt bleibt stumm, weil
> die Anleitung ausdrücklich erlaubt, einzelne Blätter leer zu lassen. Beim Bauen ist dabei
> aufgefallen, dass der **Flach-Fallback** dieselben Zähler füllt, aber per Definition keines
> der drei Blätter hat — ohne ein zusätzliches `flachGenutzt` wäre er auf „0 Datensätze“
> zurückgefallen. Das ist mitgetestet.
>
> Abgesichert durch [`test/test-xlsx-import-blattnamen.js`](../test/test-xlsx-import-blattnamen.js)
> (8 Prüfungen). Der Test schneidet `parseNum` und den Meldungsaufbau **im Wortlaut** aus
> `js/app.js` — er prüft ausgelieferten Code, keine Kopie. Die ASCII-Regel wird **gerechnet**
> (`ä→ae`) statt aufgezählt, damit ein künftiger Blattname sie automatisch erbt.
> Gegenprobe gemacht: alle vier Fehler einzeln zurückgebaut, der Test schlägt jedes Mal an.
> Alle 40 Harnesses grün.
>
> ⚠️ **Für diese Datei heißt „behoben“ nicht „funktioniert“.** Fund 3 steht weiter offen, also
> kommen die 338 Verkäufe jetzt mit **0,00 € und dem heutigen Datum** an. Der Tippfehler war
> trotzdem ein Defekt — aber wer die Datei heute einliest, bekommt mehr Unsinn als vorher,
> nicht weniger.

**Fund 3 und 4 bleiben offen** — das sind Produktentscheidungen, keine Reparaturen:
- **Fund 3:** Kopfzeile gegen die erwarteten Namen prüfen und bei Abweichung **abbrechen**
  statt zu importieren? Das würde fremde Tabellen künftig abweisen, die heute (fehlerhaft)
  durchlaufen. Alternativ nur warnen.
- **Fund 4:** Blatt-Auswahlfeld im Import-Dialog, statt fest `SheetNames[0]`. Betrifft drei
  Stellen (`lager/page.js:1865` und `:2359`, `js/buchungen.js:1640`) und ist echte UI-Arbeit.

### 2. Cloud-Sync mit zwei echten Profilen · ~30 Min

Der Mock-Test ist bestanden, der echte steht aus. **Braucht zwei getrennte Browserprofile**, nicht
zwei Tabs — die Gerätesperre hängt an `oyi_device_owner_uid`.

> **Teilweise schon belegt:** Am 2026-08-23 lief in Produktion ein Zwei-Geräte-Lauf mit echtem
> Konto (zweites Gerät als Inkognito-Fenster). Bestanden hat dabei der **Einstieg auf dem
> zweiten Gerät**: Erkennung, Code-Eingabe, Landung im Dashboard der richtigen Firma, keine
> Dublette angelegt. **Nicht** abgedeckt und unten weiterhin offen: der Konfliktfall, die
> Art.-17-Löschung und der Sync-Punkt in der Topbar.

- [ ] Profil A: Sync aktivieren, Code notieren
- [ ] Profil B: mit demselben Code koppeln → kommen die Daten an?
- [ ] In A eine Buchung anlegen, in B synchronisieren → ist sie da?
- [ ] **Konfliktfall:** in A **und** B dieselbe Buchung ändern, dann beide syncen. Erwartung: CAS
      erkennt den Versionssprung, kein stiller Datenverlust
- [ ] Firma in A anlegen → taucht sie in B im Firmenumschalter auf, ohne Neuladen?
- [ ] Sync-Punkt in der Topbar: dreht er sichtbar während des Laufs und zeigt der Tooltip
      `(Firma, 2 von 3)`?
- [ ] Löschung nach Art. 17 DSGVO: Sync in A deaktivieren und Daten löschen → ist der Blob weg?

### 3. Steuerberater-Zugang mit zwei Accounts · ~20 Min

- [ ] Freigabe in A erteilen, Fingerabdruck notieren
- [ ] Im StB-Account: stimmt der angezeigte Fingerabdruck **zeichengenau** mit dem in A überein?
- [ ] Sind die Daten dort wirklich **nur lesbar** — Speichern-Buttons gesperrt, Toast erscheint?
- [ ] Freigabe in A zurückziehen → verliert der StB sofort den Zugriff?

### 4. Make.com-Webhook · ~10 Min

> **Zwei der fünf Punkte sind am 2026-08-29 vorab am Code geklärt** — sie brauchen dich nicht
> mehr, nur noch eine Gegenprobe im Vorbeigehen:
>
> - **CSP steht schon richtig.** `connect-src` führt `https://*.make.com`, und zwar in
>   `vercel.json` **und** im `<meta>`-Tag von `app.html`. Custom-Webhooks liegen auf
>   `hook.eu1/eu2/us1.make.com` — alle darunter. Die Konsole trotzdem offen halten: es geht
>   darum, ob der *echte* Host passt, nicht ob die Regel existiert.
> - **Eine falsche URL scheitert nicht stumm — beim Eintragen.** Neben dem Feld sitzt ein
>   Test-Knopf ([`js/app.js:1047`](../js/app.js)), der einen Toast wirft, im Erfolgs- wie im
>   Fehlerfall. **Aber:** beim echten Ereignis ist es umgekehrt — `Webhooks.fire()` schluckt
>   jeden Fehler bewusst (`.catch(() => {})`, kein Retry), damit ein toter Webhook nie das
>   Speichern einer Rechnung kippt. Ein Webhook, der erst *später* kaputtgeht, fällt dem
>   Nutzer also nirgends auf. Das ist eine Entscheidung, keine Lücke — aber prüf beim Test,
>   ob dir das so recht ist.

- [ ] Webhook-URL in den Einstellungen hinterlegen, Test-Knopf drücken → Toast erscheint?
- [ ] Ereignis auslösen (neue Rechnung) — **der eigentliche Test**
- [ ] Kommt in Make.com ein Aufruf an, mit den erwarteten Feldern (`event`, `ts`, `data`)?
- [ ] Konsole währenddessen offen: keine CSP-Meldung zum echten Make-Host?

### 5. Lager-Feature-Batch, Punkt 10 · ✅ gelaufen 2026-09-01 bis 2026-09-03 — **3 Funde**

Gelaufen **auf Produktion** in der Firma „Test" (siehe die Warnung oben: lokal kommt man am
Gate nicht vorbei). An diesem Punkt haben mehrere Sessions parallel gearbeitet; die Zuordnung
steht bei den einzelnen Haken.

- [x] **Artikel anlegen, eigene Nummer, Duplikat versuchen** ❌ **Es wird nicht abgewiesen.**
      `isArtikelNrTaken()` hängt nur im Edit-Zweig von `savePurchase`; Neu-Dialog und
      Bulk-Einkauf setzen `artikelNr` direkt, der Neu-Zweig generiert nur bei **leerem** Feld.
      Live belegt: zwei Artikel `DUP-TEST-1` mit verschiedenen IDs nebeneinander, beide mit
      `isArtikelNrTaken(nr, eigeneId) === true`. Gefunden von einer Parallel-Session,
      unabhängig reproduziert. Folge: der Verkäufe-Import ordnet über die Nummer zu
      (`artNrMap`, letzter gewinnt) → Verkauf am falschen EK → falsche §25a-Marge und EÜR.
      **Behoben in `dddea9d`**, Fundbeschreibung in [`01-AUFGABEN.md`](01-AUFGABEN.md) 1.3.
- [x] **„Artikel aus Lager" → sofort als verkauft markiert?** ✅ **Ja.** Gemessen direkt nach
      dem Verknüpfen: `status: verkauft`, `verkaufsdatum` gesetzt — und zwar bei
      `getRechInvoices().length === 0`, die Rechnung war zu dem Zeitpunkt **noch nicht
      gespeichert**. Der Gegenweg trägt ebenfalls: Position entfernen setzt auf `verfuegbar`
      zurück und leert das Verkaufsdatum.
      ⚠️ **Daneben ein eigener Fund:** verlässt man die Rechnung, ohne die Position zu entfernen
      und ohne zu speichern, bleibt die Markierung stehen — Ware aus dem Bestand verschwunden,
      ohne Umsatz. Beschrieben als [`01-AUFGABEN.md`](01-AUFGABEN.md) 1.5, **noch offen**.
- [x] **Retoure auf diesen Verkauf → §25a-Marge?** ✅ **Stimmt — nach dem Fix.**
      Der Fehler war real (`margeEinzeldifferenz()` las `margeKorrektur` nicht, Bemessungs-
      grundlage blieb bei 50 statt 0, **nur** in der Standardmethode `differenzMethode='einzel'`);
      gefunden von einer Parallel-Session, **behoben in `dddea9d`**.

> **Messung zu Punkt 3, 2026-09-03.** Aufgebaut wurde der Fall live auf Produktion: Artikel
> `CC-P3-1` (EK 100, differenzbesteuert) über den Neu-Dialog, Rechnung `RE-2026-001` über
> **150 €** mit §25a-Position, verknüpft auf den Lagerartikel. `differenzMethode` stand auf
> `einzel`, also im fehlerhaften Pfad.
>
> Gerechnet wurde dann gegen die **von Produktion ausgelieferte** `js/steuer-berechnung.js`
> (per `curl` geholt, nicht gegen den Repo-Stand — die beiden können auseinanderlaufen):
>
> | Szenario | margeBrutto | USt |
> |---|---|---|
> | nur Verkauf | 50,00 | 7,98 |
> | **+ volle Retoure** | **0,00** | **0,00** |
> | + halbe Retoure | 25,00 | 3,99 |
>
> Die 50,00 / 7,98 sind zeichengleich der Vorher-Wert aus dem Node-Harness der meldenden
> Session — es ist also derselbe Fall, und er rechnet jetzt richtig.
>
> **Gegenprobe zum Floor**, weil der Fix ihn hätte aufweichen können: zwei Positionen mit
> +50 und −20 ergeben **50,00**, nicht 30,00. Es wird also weiterhin **nicht** zwischen
> Positionen verrechnet — §25a Abs. 3 bleibt gewahrt. Die Korrektur wirkt nur innerhalb
> derselben `ref`-Gruppe.
>
> **Was diese Messung nicht abdeckt:** den Klickweg der Gutschrift. Der Browser fror während
> des Laufs mehrfach ein (Tabs starben, `Runtime.evaluate` lief in 45-s-Timeouts). Belegt sind
> damit die Datenseite (Artikel und Rechnung wirklich über die Oberfläche angelegt) und die
> Rechenseite (ausgelieferter Code) — **nicht** die Kette „Gutschrift klicken → `margeKorrektur`
> geschrieben → UVA zeigt 0" in einem Durchgang.

> **Zwei Beobachtungen am Rand, beide kein Fehler, beide leicht zu verwechseln:**
>
> 1. **Eine gespeicherte Rechnung erzeugt keinen `Sale`.** `Store.getSales()` blieb auf 0, die
>    Dokumente liegen in `getRechInvoices()`. Die §25a-Berechnung liest die **Rechnungs-
>    positionen** ([`js/ustvoranmeldung.js:122`](../js/ustvoranmeldung.js) ff.), nicht die
>    Verkäufe — wer sie über `getSales()` sucht, findet nichts und hält es für einen Fehler.
> 2. **Es gibt zwei getrennte Unternehmensprofile.** Der §14-Gate liest
>    `Store.getRechUnternehmen()`, nicht `Store.getSettings()`. Eine in den Einstellungen
>    gepflegte Steuernummer blockiert die Rechnung trotzdem. Der Toast in
>    [`rechnungen/js/rechnung.js:1008`](../rechnungen/js/rechnung.js) sagt korrekt
>    „Unternehmensdaten" — der in [`dokumente.js:446`](../rechnungen/js/dokumente.js) sagt für
>    dieselbe Sache „Bitte in **Einstellungen** ergänzen". Eine der beiden Formulierungen
>    schickt den Nutzer an die falsche Stelle.

**Testdaten in der Firma „Test"**, absichtlich stehen gelassen: `CC-P2-1` (Beleg für Fund 1.5,
im Phantom-Zustand „verkauft" ohne Rechnung), `CC-P3-1`, `RE-2026-001`, Kunde „Testkunde
Punkt3", Unternehmensdaten „Testfirma Punkt3", Steuernummer `99/999/99999 (TESTDATEN)`.
Alles fiktiv — aber es liegt in der Produktionsdatenbank und gehört beim Aufräumen gelöscht.

### 6. Edge-Tastaturtest der Gate-Overlays · ✅ erledigt 2026-08-29

Gelaufen auf frischem Port 4337 gegen `app.html` im abgemeldeten Zustand — das ist der
Login-Gate-Screen `#whopLoginOverlay`. Konsole fehlerfrei, alle 36 Node-Harnesses grün.

- [x] **Tab-Reihenfolge bleibt gefangen.** Zwei fokussierbare Elemente im Overlay
      (`#whopLoginBtn`, Link „7 Tage kostenlos testen“). Tab auf dem letzten springt auf das
      erste, Shift+Tab auf dem ersten auf das letzte — beide Male mit `preventDefault`.
      Der Hintergrund kann gar nicht erst drankommen: `_lockBackground()` setzt auf **allen**
      Geschwisterknoten `inert` **und** `aria-hidden="true"`, im Baum nachgezählt.
- [x] **Fokusring ist sichtbar.** Global `:focus-visible { outline: 2px solid var(--accent);
      outline-offset: 2px }` ([`css/style.css:1175`](../css/style.css)), live gemessen als
      `solid 2px rgb(16,185,129)` auf Overlay-Grund `rgb(8,8,15)` — **7,8:1**, das Dreifache
      der von WCAG 2.4.11 geforderten 3:1. Der Anmeldeknopf ist selbst smaragdgrün, der Ring
      wäre auf ihm unsichtbar; die 2px Versatz legen ihn aber auf den dunklen Grund daneben.
- [x] **Escape schließt nicht — und soll das auch nicht.** Alle drei Gates rufen
      `_trapFocus(overlay, { closable: false })`; der Escape-Zweig hängt an `opts.closable`.
      Live gegengeprüft: Overlay bleibt stehen. Richtig so — ein wegdrückbares Gate wäre keins.
- [x] **Fund: Der Screenreader las nur „Dialog“.** → gefixt, siehe unten.

> **Fund und Fix (`js/whop-auth.js`).** `_trapFocus()` setzte `role="dialog"` und
> `aria-modal="true"`, aber **keinen zugänglichen Namen**. Im Baum stand blank `dialog`: wer
> mit Screenreader ankommt, hört beim Betreten den Grund der Sperre nicht. Betroffen waren
> alle drei Gates — Login, Gerätesperre, Kein-Abo.
>
> `_trapFocus` nimmt jetzt `label` bzw. `labelledBy` entgegen. Login bekommt
> `aria-label="Anmeldung erforderlich"` (seine Überschrift lautet nur „Stackr“ und nennt den
> Grund nicht), Gerätesperre und Kein-Abo zeigen per `aria-labelledby` auf ihre eigene `<h2>` —
> so wie es der reguläre Modal in [`js/app.js:795`](../js/app.js) längst macht. Kein
> Doppeltext, der auseinanderlaufen kann.
>
> **Belegt:** Der Login-Gate steht im Baum jetzt als `dialog "Anmeldung erforderlich"`.
> Die beiden `aria-labelledby`-Gates sind **nur statisch** belegt (ID und Attribut greifen
> zeichengenau ineinander) — der Baumleser der Browser-Pane wertet `aria-labelledby`
> nachweislich überhaupt nicht aus, ein Testknopf mit Label blieb dort unter seinem Rohtext
> stehen. Echte Screenreader tun es; dieselbe Mechanik trägt im Repo jeden normalen Modal.
> Wer beim nächsten Login ohnehin am Gerät sitzt, kann es mit NVDA in zehn Sekunden
> gegenhören.

> **Was hier nicht ging:** Screenshots und echte Tastendrücke — die Browser-Pane war nicht
> eingeblendet, ohne sie kompositiert die Seite keine Frames und Tastenereignisse kommen nicht
> in der Seite an (nachgewiesen: ein `keydown`-Mitschnitt blieb leer). Die Trap-Grenzen sind
> deshalb per Event-Dispatch geprüft, der Ring rechnerisch aus den *live* ausgelesenen
> Computed Styles. Wer die Pane offen hat, sieht denselben Befund in einem Screenshot.

### 7. Belegerkennung an einem echten Bon · ✅ gemessen 2026-08-30 — **2 von 3**

> **Die Überschrift bleibt bei „2 von 3", und das ist Absicht.** Gemessen wurden 2 von 3; die
> dritte Zahl kam erst durch eine Regel zustande, die es beim Lauf noch nicht gab. Ein „3 von 3"
> ohne diesen Hinweis wäre geschönter, als die Sache hergibt — und es ist genau die Zahl, mit
> der später geworben werden soll. Der Nachher-Wert steht unten bei der Bruttosumme.

Der einzige offene Punkt aus der OCR-Session (Fund G4, gebaut 2026-08-27). Geprüft ist bisher
**nur an synthetischen Bildern** — sauber und absichtlich verschlechtert, dort je 3 von 3 Feldern.
Ein Bonfoto lässt sich aber nicht synthetisieren: Thermopapier, Knicke, verblasster Druck und
Handykamera sind genau die Eigenschaften, die das Testbild nicht hatte.

> **Diese Messung ist die Bedingung dafür, das Feature bewerben zu dürfen.** `index.html` ist
> bewusst unberührt, bis eine Trefferquote vorliegt — beworben wird dann mit der Zahl, nicht
> mit dem Wort „automatisch" ([`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md), §5 UWG).

**Was du mitbringst:** ein Foto eines echten Bons (JPG/PNG, so wie es das Handy aufnimmt — nicht
nachbearbeitet, nicht zugeschnitten) und die drei tatsächlichen Werte dazu: Datum, Verkäufer,
Bruttosumme. Ohne die Sollwerte ist der Lauf keine Messung, sondern nur ein Eindruck.

> **Das Bild gehört nicht ins Repo.** Ein Bon trägt Ort, Zeit und Zahlungsart; er wird für den
> Lauf gebraucht, nicht für die Historie. Ablage im Scratchpad der Sitzung.

**Login:** für die reine Genauigkeitsmessung **nicht nötig** — die Erkennung hängt an
[`js/beleg-ocr.js`](../js/beleg-ocr.js) und den Vendor-Dateien, nicht am Gate. Wer ohnehin
angemeldet ist, nimmt gleich den echten Klickweg in `eigenbelege/` und prüft beides in einem.

**Gelaufen am 2026-08-30** an einem Bauhaus-Kassenbon (Ravensburg, 06.07.2026, 85,90 € für zwei
Stufenschwerlastregale, EC-Zahlung). Frischer Port **4339**, Messumgebung im Scratchpad — der Bon
trägt IBAN-Fragment, Kartennummer, Terminal-ID und Steuernummer und hat das Repo nie berührt.

- [x] **Datum** ✅ `2026-07-06`. **Aber nicht aus der Datumszeile** — die zerfiel zu
      `Datünı Aa 0 o607.2026`, der Punkt zwischen Tag und Monat ging verloren. Getragen hat die
      Fußzeile unter dem Barcode (`06.07.26 11:36 587`). Dass die Früheste-Regel über den
      *ganzen* Text läuft und nicht über eine erkannte „Datum:"-Zeile, hat den Treffer hier
      gerettet — vorher war das nur gegen Druckdatum-Dubletten gedacht.
- [ ] **Bruttosumme** ❌ **`785,90` statt `85,90`** — Zehnfach-Überhöhung. Ursache und
      Bewertung unten. **Bleibt als Fehltreffer stehen:** der Kasten ist die Messung, nicht der
      heutige Codestand. Mit der danach gebauten Gegenprobe liefert derselbe Rohtext `85,90`,
      aber das ist ein **Nachher-Wert** — er gehört nicht in die Messzeile, sonst behauptet das
      Protokoll eine Genauigkeit, die die Erkennung an diesem Bon nicht hatte.
- [x] **Verkäufer** ✅ `Bauhaus GmbH & Co, KG Schwaben` (Komma statt Punkt, sonst korrekt).
      Auch das ein Treffer durch Durchfallen: das **BAUHAUS-Logo wurde gar nicht gelesen** —
      weiße Schrift auf schwarzen Kästen, tesseract liefert dafür nichts. Die Regel nahm die
      nächste Zeile, und die war die richtige. Auf einem Bon, dessen Kopf nur aus dem Logo
      besteht, gäbe es keinen Verkäufer.
- [x] **Rohtext festhalten** — liegt im Scratchpad (`bon-lauf/rohtext.txt`), vollständig unten
      in der Fundbeschreibung zitiert, soweit er zur Sache gehört. Konfidenz **56**, zwei Läufe
      zeichengleich (der Fehler ist also reproduzierbar, kein Zufallsausrutscher).
- [x] Dauer: Worker-Aufbau **1,2 s**, Erkennung kalt **4,6 s**, warm **3,4 s**.
      ⚠️ **Das ist nicht die Nutzererfahrung.** Gemessen gegen `localhost` — die ~9 MB kamen
      von der Platte, nicht übers Netz. Der erste Klick eines echten Nutzers dauert deutlich
      länger; diese Zahl taugt nur als Untergrenze.
- [x] Konsole leer, insbesondere **kein** `Refused to compile WebAssembly`.
      ⚠️ Belegt aber nichts Neues zur CSP: der Harness lief unter `python -m http.server`,
      der **gar keine CSP-Header schickt**. Die CSP-Aussage vom 2026-08-27 (gemessen mit
      `scripts/csp-preview-server.js` unter den echten `vercel.json`-Headern) bleibt die
      maßgebliche.

> **Fund: `SUMME [2]` wird zu `SUMME [2` — und die schließende Klammer landet als `7` am
> Betrag.** Die Zeile kam als `SUMME [2 EUR 785,90` aus der Erkennung. Die Heuristik hat sich
> dabei **korrekt verhalten**: sie hat die Summenzeile bevorzugt (`RE_SUMMENZEILE` greift auf
> „SUMME") und den einzigen Betrag darin genommen. Auch der Rückfall hätte nicht geholfen —
> `785,90` ist zugleich der größte Betrag auf dem ganzen Bon.
>
> Das ist also **kein Regelfehler im bisherigen Sinn, sondern eine fehlende Gegenprobe.** Im
> Rohtext steht die Wahrheit dreimal:
>
> | Betrag | Vorkommen |
> |---|---|
> | `785,90` | **1×** (nur die verunglückte Summenzeile) |
> | `88,80` | 1× (verlesenes `EC-Cash … 85,90`) |
> | `85,90` | **3×** (Artikelzeile, `Betrag EUR`, `BRUTTO`) |
> | `72,18` / `13,72` | je 1× (Netto und MwSt — **72,18 + 13,72 = 85,90**) |
>
> **Warum dieser Fehltreffer schwerer wiegt als ein verlesener Händlername:** er betrifft das
> Geldfeld, und er geht **nach oben**. Ein übernommener Eigenbeleg über 785,90 € statt 85,90 €
> ist eine um 700 € zu hohe Betriebsausgabe und ein um 111,72 € zu hoher Vorsteuerabzug.
> Automatisch eingetragen wird nichts — der Chip muss geklickt werden, so wie es
> [`js/beleg-ocr.js`](../js/beleg-ocr.js) im Kopf festhält. Aber `85,90` und `785,90`
> unterscheiden sich um **ein Zeichen am Zeilenanfang**, und der Chip ist genau die Stelle, an
> der man schnell klickt statt liest.
>
> **Inzwischen gebaut** (2026-08-30, `f487f1b`): die **Konsens-Gegenprobe**. Gewinnt ein Betrag
> die Summenzeile, kommt aber im ganzen Bon **nur einmal** vor, während ein anderer Betrag
> **mehrfach** vorkommt und ein Ziffern-Suffix des Gewinners ist (`85,90` ist Suffix von
> `785,90`), dann gewinnt der mehrfache. Die Regel feuert eng — nur auf das beobachtete Muster
> „eine Ziffer vorn drangeklebt" — und steht in
> [`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md), Abschnitt 5a.
> Die arithmetische Probe `Netto + MwSt = Brutto` ist dort als Option vermerkt, aber **nicht**
> gebaut: sie geht auf diesem Bon exakt auf, setzt aber einen erkannten Steuerblock voraus, und
> im Rohtext stehen Label und Werte auf zwei verschiedenen Zeilen.
>
> Die Regel wurde danach zweimal nachgeschärft, beide Male auf Meldung aus Parallel-Sessions:
> `03a7475` (die Bestätigung schlug auch in „Rabattbetrag" an und zog eine **korrekt gelesene**
> Summe herunter) und `927275d` (eine „Zwischensumme" landete im Summenpool und schlug mit
> Rabatt den echten Endbetrag). Beide Nachschärfungen betrafen **nicht** den hier gemessenen
> Bon — sie kamen aus dem Gegenlesen der neuen Regel.
>
> **Eine Messung ist noch keine Quote.** n = 1. Das Bild kam zudem über WhatsApp
> (1536 × 2048, 334 KB) und war damit schon einmal rekomprimiert — ein realistischer Weg, aber
> nicht die Rohdatei der Kamera.

**Bewerbungsfrage:** bleibt **zu**. Mit `index.html` unberührt ist alles richtig — bei einem
gemessenen Bon, dessen Betragsfeld danebenliegt, wäre jede Zahl in der Werbung angreifbar
(§5 UWG), und „automatisch" erst recht.

---

## Was in derselben Sitzung mit erledigt werden kann

- **Owner-Gegenprobe** — ✅ **erledigt 2026-09-01.** `/api/whop-access` auf Produktion
  antwortete `200` mit `has_access: true`, **`owner: true`** und einem Grace-Token, für
  `user_ljp5xcrqojylg`. `WHOP_OWNER_IDS` in Vercel ist damit nachweislich richtig gesetzt —
  der Owner-Pfad in [`api/whop-access.js:254`](../api/whop-access.js) ist die einzige Stelle,
  die `owner: true` überhaupt zurückgibt. Damit ist der letzte Rest aus 2.1 zu.
  Der Zugriffstoken wurde dabei nur durchgereicht, nicht ausgelesen.
- **`ALERT_WEBHOOK_URL`** — sonst versanden die Fail-open-Meldungen aus `api/_alert.js` im Log
- **Whop-Mails** aus [`whop-mails-entwuerfe.md`](whop-mails-entwuerfe.md), wenn du eh im
  Whop-Dashboard bist

## Wenn etwas schiefgeht

Nicht selbst reparieren, sondern **festhalten**: Screenshot, Konsolentext, welcher Schritt. Ein
Fehler mitten in einer Testreihe verleitet dazu, den Rest abzubrechen — besser die Reihe zu Ende
gehen und danach alles auf einmal fixen.
