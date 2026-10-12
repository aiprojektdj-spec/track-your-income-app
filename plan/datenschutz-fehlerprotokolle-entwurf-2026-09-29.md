# Entwurf: datenschutz.html — Fehlerprotokolle (Betriebslücken §4)

Stand 2026-09-29. **Noch nicht eingebaut.** Erst nach Freigabe durch den User, und erst wenn
die Session „Barrierefreiheit 2026" ihre Änderungen an `datenschutz.html`/`cookies.html`
committet hat (sonst nimmt ein pfad-gescopter Commit deren Hunks mit).

Zusammen damit committen: `js/error-logger.js` und `test/test-error-logger-beacon.js`
(liegen fertig im Working Tree). Der Serverteil ist schon committet; ohne den Client
kommt dort nichts an.

---

## 1. Ersetzen in Ziffer 3 (Absatz „Zusätzlich speichert die App …")

Alt: „… Diese Einträge verlassen dein Gerät nicht automatisch; sie werden nur an einen Server
übertragen, wenn du sie selbst über die Funktion „Diagnose exportieren" …"

Neu:

```html
<p>
    Zusätzlich speichert die App bei technischen Fehlern automatisch ein
    <strong>Fehlerprotokoll</strong> (Schlüssel <strong>stackr_error_log</strong>, max. 50 Einträge)
    lokal auf deinem Gerät — mit Zeitstempel, Fehlermeldung, Browser-Kennung und der Stelle im Code,
    an der der Fehler auftrat. Es enthält keine Buchhaltungsdaten. Eine stark gekürzte Fassung
    jedes Fehlers wird außerdem an unseren Server gemeldet (siehe Ziffer 2.4). Damit derselbe
    Fehler nicht mehrfach gemeldet wird, merkt sich die App bis zum Schließen des Tabs, welche
    Fehler schon gemeldet sind (Schlüssel <strong>stackr_error_sent</strong>, sessionStorage).
    Das vollständige lokale Protokoll verlässt dein Gerät nur, wenn du es selbst über
    „Diagnose exportieren" (Backup-Menü) als Datei herunterlädst und weitergibst.
</p>
```

## 2. Neu in Ziffer 2, nach 2.3

```html
<h3>2.4 Fehlerprotokolle</h3>
<p>
    Tritt in der App ein technischer Fehler auf, meldet dein Browser eine kurze
    Fehlerbeschreibung an unseren Server, damit wir Fehler erkennen und beheben können, bevor
    sie viele Nutzer treffen. Übertragen werden <strong>nur</strong>: die Art des Fehlers, die
    Fehlermeldung (gekürzt auf 300 Zeichen; E-Mail-Adressen und Zahlenfolgen ab vier Stellen
    werden vor dem Speichern entfernt), der Name der Programmdatei samt Zeile und Spalte, die
    App-Version und der Zeitpunkt.
</p>
<p>
    <strong>Nicht</strong> übertragen werden deine Buchhaltungsdaten, dein Name, deine
    Nutzerkennung, die aufgerufene Seite, deine Browser-Kennung oder der technische
    Programmablauf (Stack-Trace). Deine IP-Adresse wird nur zur Missbrauchsabwehr kurz
    verarbeitet (Zähler für die Anzahl der Meldungen, nach 60 Sekunden gelöscht) und nicht
    zusammen mit dem Fehler gespeichert. Gleiche Fehler werden zusammengefasst und nur gezählt.
</p>
<p>
    Gespeichert wird bei <strong>Upstash</strong> (Upstash, Inc.) in der Region
    <strong>Frankfurt am Main (EU)</strong>. Die Einträge werden nach <strong>30 Tagen</strong>
    automatisch gelöscht. Einmal täglich erhalten wir eine Zusammenfassung neu aufgetretener
    Fehlerarten per E-Mail (über Make.com); sie enthält dieselben, bereits bereinigten Angaben.
</p>
<p>
    Rechtsgrundlage: <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> (berechtigtes Interesse an einer
    fehlerfreien und sicheren App). Du kannst der Verarbeitung nach Art. 21 DSGVO widersprechen;
    eine formlose Nachricht an die in Ziffer 1 genannte Adresse genügt.
</p>
```

## 3. Ziffer 7 (AVV)

Upstash ist bisher nur „bei aktiviertem Cloud-Sync" genannt. Ergänzen: „sowie für die
Fehlerprotokolle nach Ziffer 2.4 (alle Nutzer der App)". Make.com ist für die Alarm-Mails
ohnehin schon Dienstleister — prüfen, ob es in Ziffer 7 steht; die Tagesmail enthält nur die
bereinigten Angaben, keine IP.

## 4. Ziffer 8 (Speicherdauer), neuer Listenpunkt

```html
<li>Fehlerprotokolle (Ziffer 2.4): automatisch nach 30 Tagen</li>
```

## 5. cookies.html

Zeile für `stackr_error_sent` (sessionStorage, technisch notwendig, bis Tab geschlossen)
neben `stackr_error_log` ergänzen.

## Offene Fragen an den Anwalt / `/datenschutz`

- Reicht lit. f, oder wird für die Übermittlung vom Endgerät § 25 Abs. 2 Nr. 2 TDDDG
  bemüht? (Gelesen wird nichts vom Endgerät außer dem aufgetretenen Fehler; gespeichert wird
  nur `stackr_error_sent` im sessionStorage — technisch notwendig für die Entprellung.)
- Fehlermeldungen können in seltenen Fällen Namen enthalten („'Müller GmbH' is not a
  function"). E-Mails und Ziffern werden gefiltert, Namen nicht. Hinnehmbar bei 30 Tagen?
