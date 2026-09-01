# Live-Tests — Checkliste für eine Sitzung

**Stand: 2026-08-30.** Aufgabe 2.3 aus [`01-AUFGABEN.md`](01-AUFGABEN.md).

> **Punkt 6 ist am 2026-08-29 abgearbeitet** — er brauchte keinen Login, weil das Gate genau
> der Zustand *ohne* Anmeldung ist. Ergebnis, Fund und Fix stehen unten bei Punkt 6.
> **Punkt 7 (Bon) ist am 2026-08-30 gemessen** — ebenfalls ohne Login, an einem echten
> Bauhaus-Bon: **2 von 3**, und der Fehltreffer ist ausgerechnet die Bruttosumme
> (`785,90` statt `85,90`). Fund, Rohtext-Befund und ein Fixvorschlag stehen unten bei Punkt 7;
> die Entscheidung über die Regeländerung steht noch aus.
> Die Punkte 1–5 warten weiter auf dich.

Sieben Funktionen sind gebaut, committet und statisch geprüft, aber nie unter echten Bedingungen
gelaufen. Fünf davon brauchen einen **echten Whop-Login** — deshalb einmal anmelden und dann
alles am Stück durchgehen, statt fünfmal einzeln.

> **Ablauf:** Du meldest dich einmal im Browser-Pane bei Whop an, die Session bleibt danach
> erhalten. Claude loggt sich nicht selbst ein, und ein Dev-Bypass im Code ist nicht gewünscht.
> Ab da kann eine Session mitlesen, Konsole und Netzwerk prüfen und die Ergebnisse festhalten.

**Vorher:** frischen Port aus `.claude/launch.json` nehmen (höchster + 1) — der
`python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am Origin. Reload,
Cache-Bust und neuer Tab liefern trotzdem alten Code.

---

## Reihenfolge — absichtlich so

Der Datentransfer steht vorn, weil alles Weitere auf vorhandenen Daten aufbaut.

### 1. Excel-Import mit einer echten Datei · ~15 Min

Nimm eine echte Datei, keine erfundene — der Sinn des Tests ist gerade, dass echte Dateien
unsauberer sind.

- [ ] Buchungen-Import: Zeilenzahl in der Datei = Zeilenzahl in der App?
- [ ] Lager-Import: Erkennt er sowohl das 3-Sheet-Template als auch eine flache
      1-Zeile-pro-Artikel-Tabelle?
- [ ] Umlaute in Artikelbezeichnungen korrekt?
- [ ] Beträge mit deutschem Dezimalkomma korrekt eingelesen (nicht Faktor 100 daneben)?
- [ ] Ein Datum am Monatsersten und -letzten stichprobenhaft gegen die Quelle prüfen

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

### 5. Lager-Feature-Batch, Punkt 10 · ~20 Min

Reiner Durchklick des zuletzt gebauten Stapels.

- [ ] Artikel anlegen, eigene Artikelnummer vergeben, Duplikat versuchen → wird es abgewiesen?
- [ ] „Artikel aus Lager" in einer Rechnung → wird er sofort als verkauft markiert?
- [ ] Retoure auf diesen Verkauf → stimmt die §25a-Marge danach noch?

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

- **Owner-Gegenprobe** — der einzige Rest aus 2.1: `/api/whop-access` muss nach dem Login
  `"owner": true` liefern. Kommt stattdessen „Stackr Pro aktivieren“, stimmt die
  `SYNC_OWNER_IDS`/`WHOP_OWNER_IDS` nicht — sie steht dort unten als Freigabe-Code.
  Ein Blick, kein eigener Termin
- **`ALERT_WEBHOOK_URL`** — sonst versanden die Fail-open-Meldungen aus `api/_alert.js` im Log
- **Whop-Mails** aus [`whop-mails-entwuerfe.md`](whop-mails-entwuerfe.md), wenn du eh im
  Whop-Dashboard bist

## Wenn etwas schiefgeht

Nicht selbst reparieren, sondern **festhalten**: Screenshot, Konsolentext, welcher Schritt. Ein
Fehler mitten in einer Testreihe verleitet dazu, den Rest abzubrechen — besser die Reihe zu Ende
gehen und danach alles auf einmal fixen.
