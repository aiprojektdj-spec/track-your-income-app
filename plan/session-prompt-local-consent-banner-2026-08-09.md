# Prompt für neue Session (copy-paste) — Local 1.7: echter Cookie-/CDN-Consent vor dem ersten Skript-Load

---

Kontext: Beim §2.2-Rechtstext-Audit (D6, 2026-08-09, `legal-reviewer`-Agent) wurde in
`Local 1.7/app.html` folgende Lücke gefunden: die App zeigt **keinen echten Cookie-Consent-Banner**,
sondern nur ein einmaliges DSGVO-Hinweis-Modal (`showDsgvoModal` in `js/app.js`) ohne
Zustimmungsfunktion — der User kann nichts ablehnen, es gibt keinen "Einverstanden"/"Ablehnen"-Fluss.

**Das eigentliche Problem:** Sechs externe CDN-Skripte laden beim App-Start **unconditional**, bevor
der User das Hinweis-Modal überhaupt gesehen oder bestätigt hat:
- `cdn.jsdelivr.net`: GSAP, Notyf, Flatpickr (×2), QR-Generator, ApexCharts
- `cdn.paddle.com`: Paddle.js (`Paddle.Initialize({ token: 'live_...' })`)

Jeder dieser Ladevorgänge überträgt die IP-Adresse des Nutzers an den jeweiligen CDN-Betreiber, bevor
irgendeine Einwilligung eingeholt wurde. `datenschutz.html` erwähnt diese CDN-Verbindungen inzwischen
(neuer Abschnitt, im selben Audit ergänzt), aber Erwähnung im Text ersetzt keine Einwilligung vor dem
Laden, falls eine nötig ist.

## Zu klärende Rechtsfrage zuerst (nicht raten, mit `legal-reviewer` oder Anwalt klären)

Nicht jedes CDN-Skript braucht zwingend eine Einwilligung — reine Funktions-Bibliotheken ohne
Tracking/Fingerprinting (GSAP, Notyf, Flatpickr, QR-Generator, ApexCharts) fallen unter Umständen
unter „technisch notwendig" bzw. berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO), wenn sie
tatsächlich nur Funktionalität liefern und kein Tracking betreiben. Paddle.js ist der heiklere Fall:

- Setzt Paddle.js beim bloßen Laden (vor Kaufabsicht) eigene Cookies/Storage zur Betrugserkennung
  oder Analytics? Das ist aus dem statischen Code nicht zu beantworten — braucht eine
  Live-Netzwerk-/Storage-Analyse im Browser (DevTools Network-Tab + Application-Tab beim reinen
  Öffnen von `app.html`, ohne auf einen Kauf-Button zu klicken).
- Falls ja: Paddle.js technisch notwendig? Eher nein, wenn der Nutzer noch keine Kaufabsicht
  geäußert hat — dann bräuchte es entweder (a) eine echte Einwilligung vorher, oder (b) einen
  Lazy-Load-Mechanismus, der Paddle.js erst beim Klick auf "Kaufen"/"Upgrade" nachlädt.

## Vorschlag Scope (v1, minimal)

1. Live-Analyse: `app.html` im Browser öffnen (Network+Application-Tab), dokumentieren was Paddle.js
   beim reinen Laden an Storage/Requests erzeugt.
2. Falls Paddle.js unproblematisch ist (keine eigenen Cookies vor Kaufabsicht): nur ein echtes
   Consent-UI vor den jsdelivr-Skripten bauen (Accept/Reject), Paddle bleibt wie es ist (bereits als
   Merchant-of-Record-Zahlungsabwicklung in `datenschutz.html` §6 offengelegt, Vertragserfüllung
   Art. 6 Abs. 1 lit. b greift ab Kaufabsicht plausibel auch für das Laden des Checkout-SDKs).
3. Falls Paddle.js doch eigene Tracking-Cookies vor Kaufabsicht setzt: Lazy-Load von Paddle.js erst
   beim Klick auf den Kauf-/Upgrade-Button (Pattern existiert schon ähnlich in der Codebase, s.
   Kommentar in `app.html` zu `PaddleLoader`/`js/paddle-init.js` — laut Kommentar dort mal geplant,
   nie gebaut).
4. Echter Consent-Banner (nicht nur Hinweis-Modal) vor `app.html`-Skript-Ladevorgängen, analog zum
   bestehenden `js/cookie-banner.js`-Pattern von `datenschutz.html`/`impressum.html` — dort aber
   bisher nicht in `app.html` selbst eingebunden.

## Nicht in v1 (bewusst weglassen, YAGNI)

- Kein granulares Consent-Management mit einzeln togglebaren Kategorien — ein einfacher
  Accept/Reject-Banner reicht für den aktuellen Umfang externer Skripte.
- Keine Änderung an Web 1.7 — dort ist die Situation vermutlich anders (Whop statt Paddle,
  andere CDN-Abhängigkeiten), separat prüfen falls relevant.

## Akzeptanzkriterien

- [ ] Dokumentiert, was Paddle.js beim reinen Laden (vor Kaufabsicht) tatsächlich an
      Storage/Requests erzeugt
- [ ] Rechtliche Einordnung (technisch notwendig vs. einwilligungspflichtig) für Paddle.js und die
      jsdelivr-Skripte getroffen — mit Begründung, nicht geraten
- [ ] Consent-Mechanismus so gebaut, dass einwilligungspflichtige Skripte erst NACH Zustimmung laden
- [ ] `datenschutz.html` ggf. an den finalen Consent-Flow angepasst (Formulierung "lädt beim
      App-Start" ggf. nicht mehr zutreffend, falls Lazy-Load eingeführt wird)
- [ ] Lokal im Browser verifiziert (Network-Tab: keine CDN-Requests vor Consent, außer als
      technisch-notwendig eingestufte)

## Abschluss

Nach Umsetzung: diese Datei hier als erledigt markieren (Überschrift durchstreichen, nicht löschen)
und `plan/OFFEN.md` §2.2 entsprechend ergänzen (die Frage 1 aus dem D6-Audit ist dann beantwortet).
