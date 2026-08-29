# Live-Tests — Checkliste für eine Sitzung

**Stand: 2026-08-29.** Aufgabe 2.3 aus [`01-AUFGABEN.md`](01-AUFGABEN.md).

> **Punkt 6 ist am 2026-08-29 abgearbeitet** — er brauchte als einziger keinen Login, weil
> das Gate genau der Zustand *ohne* Anmeldung ist. Ergebnis, Fund und Fix stehen unten bei
> Punkt 6. Die Punkte 1–5 warten weiter auf dich.

Sechs Funktionen sind gebaut, committet und statisch geprüft, aber nie unter echten Bedingungen
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

### 4. Make.com-Webhook · ~15 Min

- [ ] Webhook-URL in den Einstellungen hinterlegen
- [ ] Ereignis auslösen (neue Rechnung)
- [ ] Kommt in Make.com ein Aufruf an, mit den erwarteten Feldern?
- [ ] **CSP prüfen:** Konsole offen halten — `connect-src` muss den Make-Host kennen, sonst
      blockiert der Browser still
- [ ] Falsche URL eintragen: bekommt der Nutzer eine sichtbare Fehlermeldung oder scheitert es
      stumm?

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
