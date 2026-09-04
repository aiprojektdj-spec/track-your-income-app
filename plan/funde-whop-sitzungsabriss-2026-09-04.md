# Whop-Sitzungsabriss: jeder Kunde fliegt stündlich raus

**Gefunden 2026-09-04** beim Versuch, die Live-Tests durchzuführen — nicht gesucht, sondern
dreimal hintereinander drübergestolpert. Alles unten ist am Code und an Whops Doku belegt,
nichts davon ist geraten.

> **Warum das hier steht und nicht in `01-AUFGABEN.md`:** An der Aufgabenliste und an
> `live-tests-checkliste.md` arbeiten derzeit mehrere Sessions gleichzeitig. Eine eigene Datei
> kollidiert nicht.

---

## Was passiert

Der Whop-Login hält **eine Stunde**. Danach steht der Kunde wieder vor dem Anmeldebildschirm
und muss den kompletten OAuth-Umweg über whop.com erneut gehen. Kein Fehler, keine Meldung,
keine Erklärung — der Bildschirm ist einfach wieder da.

Beobachtet am 2026-09-04 in einer einzigen Arbeitssitzung **dreimal**. Beim letzten Mal war
`whop_access_token` schlicht aus dem `localStorage` verschwunden, ohne dass jemand abgemeldet
hatte.

## Warum

Drei Stellen greifen ineinander:

**1. Der Server wirft den Erneuerungsschlüssel weg.**
[`api/whop-token.js:88`](../api/whop-token.js) gibt aus Whops Token-Antwort nur ein Feld zurück:

```js
return res.status(200).json({ access_token: data.access_token });
```

Whops Antwort enthält laut deren Doku auch `refresh_token` und `expires_in`. Beide landen im
Nichts. Im ganzen Client gibt es **kein einziges Vorkommen** von `refresh` —
`grep -n "refresh" js/whop-auth.js` ist leer.

**2. Whops Token lebt genau eine Stunde.**
Aus der offiziellen Doku (https://docs.whop.com/developer/guides/oauth): „Access tokens expire
after 1 hour." Die Erneuerung ist dort dokumentiert — `grant_type: "refresh_token"` an denselben
Endpunkt, wobei die Refresh-Tokens bei jeder Nutzung rotieren und der neue gespeichert werden
muss.

**3. Der Ablauf vernichtet ausgerechnet das Sicherheitsnetz.**
Ein abgelaufener Token liefert bei `userinfo` **401**. Und der 401-Zweig in
[`js/whop-auth.js:323`](../js/whop-auth.js) räumt alles ab:

```js
if (meRes.status === 401 || meRes.status === 403) {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    _clearGrace();          // ← hier stirbt die 4-Stunden-Frist
    return false;
}
```

Das **Offline-Grace-Token** (4 h, ECDSA-signiert) greift nur im Zweig darunter, bei `!meRes.ok`
— also 5xx und Netzproblemen. Der Ablauf sieht im Code **identisch aus wie ein Entzug**, und
deshalb wird die Frist von genau dem Ereignis gelöscht, das sie abfedern sollte.

## Warum das mehr ist als ein Ärgernis

- **Es trifft jeden zahlenden Kunden, jeden Tag.** Wer vier Stunden am Stück bucht, meldet sich
  viermal an. Das ist kein Randfall.
- **Es sieht aus wie ein Abo-Problem.** Der Anmeldebildschirm bewirbt „7 Tage kostenlos testen"
  — ein Bestandskunde, der grundlos dort landet, liest das als „mein Abo ist weg" und schreibt
  Support an. Vergleiche den Vorfall vom 2026-07-13, wo ein falscher API-Key genau diesen
  Bildschirm auslöste und der erste Zahlkunde ausgesperrt war.
- **Arbeit kann verlorengehen.** Ein Formular, das offen ist, wenn das Gate hochkommt, ist weg.
- **Das Grace-Feature ist faktisch tot.** Es wurde für Offline-Arbeit gebaut (a76f6d1,
  2026-07-19), löst aber den Fall nicht aus, der real vorkommt.

## Was zu tun ist — drei Wege, einer davon richtig

### A · Erneuerungsweg bauen (empfohlen)

Der einzige Weg, der die Abmeldung wirklich beseitigt, und der, den Whop dokumentiert.

- `api/whop-token.js` gibt `refresh_token` und `expires_in` mit zurück
- Ein zweiter Endpunkt (oder derselbe mit `grant_type: 'refresh_token'`) tauscht um; das
  Client-Secret bleibt serverseitig
- Client erneuert vorausschauend, Whops Beispiel nimmt 5 Minuten Puffer vor Ablauf
- **Rotation beachten:** der zurückgegebene neue Refresh-Token muss gespeichert werden, sonst
  ist die Kette nach einmaligem Gebrauch tot

> ⚠️ **Die Entscheidung, die dahinter steckt und die dir gehört:** Ein Refresh-Token ist
> langlebig. Ihn in den `localStorage` zu legen, widerspricht der Linie, die in
> [`js/whop-auth.js:337`](../js/whop-auth.js) ausdrücklich kommentiert ist — dort werden aus
> Art. 5 Abs. 1 lit. c DSGVO **nur zwei Felder** persistiert, und E-Mail und Profilbild
> bewusst nicht. Wer das aufweicht, sollte es absichtlich tun. Alternativen: HttpOnly-Cookie
> vom eigenen Endpunkt gesetzt (dann ist es kein Local-First-Reinfall, aber ein Cookie), oder
> Refresh-Token serverseitig gegen eine Sitzungs-ID halten (braucht Redis, das ohnehin schon
> für das Rate-Limit läuft).

### B · Ablauf von Entzug unterscheiden (kleiner Zwischenschritt)

`_clearGrace()` im 401-Zweig entfällt, die 4-Stunden-Frist trägt weiter. Aus stündlich wird
vierstündlich. **Kostet nichts, löst es aber nicht** — und hat einen Haken: Ein wirklich
entzogener Zugang (Kündigung, Sperre) käme bis zu vier Stunden lang weiter durch. Ob das
tragbar ist, hängt daran, wie schnell ein Abogang wirken muss.

### C · Nichts tun, aber ehrlich beschriften

Wenn A und B beide nicht sollen: wenigstens den Bildschirm nach Ablauf anders texten, damit
ein Bestandskunde nicht „7 Tage kostenlos testen" liest. Behebt nichts, verhindert aber die
Support-Anfrage und den falschen Eindruck, das Abo sei weg.

## Was noch offen ist

- **Nicht gemessen:** ob Whop den Token wirklich exakt nach 60 Minuten fallen lässt oder
  früher. Die drei Abrisse lagen in einer Sitzung, ich habe die Abstände nicht protokolliert.
  Für die Entscheidung ist das egal — ohne Erneuerung endet die Sitzung so oder so.
- **Geprüft und beantwortet:** `api/whop-access.js` benutzt denselben Token und antwortet bei
  Ablauf ebenfalls mit 401 (`invalid_token`, [`api/whop-access.js:240`](../api/whop-access.js)).
  Der Client behandelt das aber **anders** als den userinfo-401: in
  [`js/whop-auth.js:366`](../js/whop-auth.js) führt es nur zu einer Konsolenwarnung, `hasAccess`
  bleibt `false` — und der Kunde landet auf dem **„Stackr Pro aktivieren“**-Bildschirm statt
  auf dem Anmeldebildschirm. Das ist der schlimmere der beiden Ausgänge, weil er dem
  Bestandskunden direkt sagt, sein Abo fehle.

  In der Praxis greift meist der userinfo-401 zuerst (er wird vorher aufgerufen, mit demselben
  Token) und führt zum vollständigen Logout. Beide Wege enden aber in einem Bildschirm, der
  eine Zahlungsaufforderung zeigt, obwohl nur ein Token abgelaufen ist.
