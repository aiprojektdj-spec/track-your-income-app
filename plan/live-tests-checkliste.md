# Live-Tests — Checkliste für eine Sitzung

**Stand: 2026-08-16.** Aufgabe 2.3 aus [`01-AUFGABEN.md`](01-AUFGABEN.md).

Sechs Funktionen sind gebaut, committet und statisch geprüft, aber nie unter echten Bedingungen
gelaufen. Alle brauchen einen **echten Whop-Login** — deshalb einmal anmelden und dann alles am
Stück durchgehen, statt sechsmal einzeln.

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

### 6. Edge-Tastaturtest der Gate-Overlays · ~10 Min

Die Logik ist geprüft, die **Wahrnehmung** nicht. Nur mit Tastatur, keine Maus.

- [ ] Tab-Reihenfolge im Gate-Overlay: bleibt der Fokus **im** Overlay gefangen?
- [ ] Ist der Fokusring auf dem dunklen Overlay sichtbar?
- [ ] Schließt Escape das Overlay — und darf es das an dieser Stelle überhaupt?
- [ ] Liest der Screenreader den Grund vor, oder nur „Dialog"?

---

## Was in derselben Sitzung mit erledigt werden kann

- **2.1 ENV-Variablen** — du bist ohnehin in Vercel eingeloggt, 10 Minuten
- **`ALERT_WEBHOOK_URL`** — sonst versanden die Fail-open-Meldungen aus `api/_alert.js` im Log
- **Whop-Mails** aus [`whop-mails-entwuerfe.md`](whop-mails-entwuerfe.md), wenn du eh im
  Whop-Dashboard bist

## Wenn etwas schiefgeht

Nicht selbst reparieren, sondern **festhalten**: Screenshot, Konsolentext, welcher Schritt. Ein
Fehler mitten in einer Testreihe verleitet dazu, den Rest abzubrechen — besser die Reihe zu Ende
gehen und danach alles auf einmal fixen.
