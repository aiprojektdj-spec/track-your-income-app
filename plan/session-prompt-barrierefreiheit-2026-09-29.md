# Session-Prompt: Erklärung zur Barrierefreiheit + Doku-Drift A11y (2026-09-29)

**Anlass:** Reel von aj.on.ai („Have you added this while VIBECODING yet?"): Jede Website sollte
eine Seite zur Barrierefreiheit haben. In den USA heißt das „ADA-Statement", in DE/EU ist die
Grundlage das **BFSG** (seit 28.06.2025).
**Stand:** Die Technik ist gut (alle A11y-Funde aus Audit 12 und Vollaudit D sind im Code erledigt).
**Was fehlt:** eine öffentliche Erklärung. Außerdem ist `OFFEN.md` veraltet.

**Rechtliche Einordnung (keine Rechtsberatung):** Stackr fällt wahrscheinlich unter die Ausnahme
für Kleinstunternehmen (Dienstleistung, weniger als 10 Beschäftigte und höchstens 2 Mio. € Umsatz)
und richtet sich eher an Geschäftskunden (B2B). Die Seite ist also **freiwillig**. Sie ist ein
Qualitätssignal, das wir ehrlich einlösen können. Die Seite darf deshalb **nichts behaupten, was
nicht geprüft ist**. Vor dem Veröffentlichen gegenlesen lassen, z. B. von `legal-reviewer` oder `/compliance-legal`.

---

## Aufgabe 1 — `barrierefreiheit.html` anlegen

Aufbau wie `impressum.html` / `datenschutz.html`: gleicher `<head>`, gleiche CSS, Skip-Link,
`lang="de"`, gleicher Footer. Am einfachsten `impressum.html` kopieren und den Inhalt ersetzen.

### Inhalt (Entwurf, vor dem Einsetzen gegen den Code prüfen)

```markdown
# Erklärung zur Barrierefreiheit

Stackr soll für alle nutzbar sein, auch mit Screenreader, nur mit Tastatur,
mit Vergrößerung oder bei eingeschränktem Farbsehen.

## Angestrebter Standard
Wir orientieren uns an den Web Content Accessibility Guidelines (WCAG) 2.1, Stufe AA.

## Was umgesetzt ist
- Alle Text- und Bedienfarben erfüllen den Mindestkontrast nach WCAG AA,
  im hellen wie im dunklen Design (45 von 45 Farbpaarungen rechnerisch geprüft).
- Die gesamte App ist per Tastatur bedienbar, mit sichtbarem Fokus.
- „Zum Inhalt springen"-Link auf allen Seiten.
- Beschriftete Bedienelemente: Icon-Buttons (z. B. Löschen, Stornieren) haben
  Namen für Screenreader.
- Formularfelder haben Beschriftungen und gut erkennbare Rahmen.
- Die Seite ist als deutschsprachig ausgezeichnet und nutzt Seitenbereiche
  (Navigation, Hauptinhalt).

## Bekannte Einschränkungen
- Diagramme im Dashboard sind grafisch. Die zugrunde liegenden Zahlen stehen
  zusätzlich in Tabellen bzw. in der EÜR.        <- PRÜFEN, ob das stimmt
- Erzeugte PDF-Rechnungen sind noch nicht als barrierefreies PDF (PDF/UA)
  ausgezeichnet.                                   <- PRÜFEN
- Ein vollständiger Test mit Screenreadern (NVDA, VoiceOver) steht noch aus.

## Barriere melden
Etwas funktioniert nicht für dich? Schreib uns über die im Impressum genannte
Kontaktadresse. Wir antworten in der Regel innerhalb von 14 Tagen.

## Stand dieser Erklärung
Erstellt am <DATUM>. Grundlage: eigene Prüfung (Kontrastberechnung, Code-Audit,
Tastaturtest), zuletzt am <DATUM>.
```

**Regeln für den Text:**
- Bei „Bekannte Einschränkungen" nur Punkte stehen lassen, die im Code bestätigt sind. Bestätigte
  Lücken gehören rein, denn eine ehrliche Liste ist besser als eine geschönte.
- Die Kontakt-Mail **nicht** in den Text kopieren, sondern aufs Impressum verlinken
  (nur eine Stelle, die gepflegt werden muss).
- Weder „vollständig barrierefrei" noch „BFSG-konform" schreiben.

## Aufgabe 2 — Verlinken

- **Footer** in allen Seiten, die `impressum.html` verlinken:
  `agb, app, cookies, datenschutz, impressum, index, landing-v2, refund, stackr-broschuere,
  verfahrensdokumentation`. In `index.html:837` hinter „Cookies" ergänzen:
  `· <a href="barrierefreiheit.html">Barrierefreiheit</a>`.
  Suchen mit `grep -ln "impressum.html" *.html`. Den Footer-Link in der App nicht vergessen, falls
  der Footer dort per JS gerendert wird.
- **`sitemap.xml`:** Eintrag analog zu `impressum.html` (Zeile ~19).
- **`vercel.json`:** Prüfen, was für `/impressum.html` gilt (Zeile ~100, Header/Rewrite), und für
  `/barrierefreiheit.html` genauso setzen.
- **`build-deploy.py`:** Prüfen, ob die neue HTML-Datei automatisch mitkommt oder in eine Liste
  eingetragen werden muss.

## Aufgabe 3 — Doku-Drift beheben

`plan/OFFEN.md:312` führt **„2.11 Accessibility-Funde — offen"**. Im Code ist alles erledigt
(geprüft am 2026-09-29):

| Fund | Beleg |
|---|---|
| A1 Akademie tastaturbedienbar | `js/akademie.js:2013` (keydown), `:2104/:2169/:2294` (`role="button" tabindex="0"`) |
| A2 Feldrand-Kontrast | `css/style.css:76` / `:150` `--border-field`, benutzt in `:1135` |
| A4 Skip-Link | `app.html:50`, `index.html:31` |
| D1 Icon-Buttons `aria-label` | `js/afa.js:131-133`, fahrtenbuch, vorsteuer |

**Noch gegenprüfen:** A3 (Foto-Kachel in `lager/page.js`, ~Z. 623) und A5 (`aria-label` an
Topnav und Sidebar). Danach Abschnitt 2.11 nach `ERLEDIGT-2026-08.md` bzw. ins aktuelle
Erledigt-Log verschieben und mit Datum und Beleg eintragen.

## Aufgabe 4 — Nachweis für die Erklärung

Damit die Seite ehrlich bleibt, einmal kurz prüfen und das Datum eintragen:
1. Lighthouse (Accessibility) auf `index.html`, `app.html` und `barrierefreiheit.html`. Ziel: 100.
2. 5-Minuten-Tastaturtest in der App: Tab durch Dashboard → Rechnung anlegen → Akademie.
3. Optional: Kurztest mit NVDA oder VoiceOver. Wenn gemacht, den Punkt unter „Bekannte
   Einschränkungen" entfernen.

## Fertig, wenn
- [ ] `barrierefreiheit.html` existiert, Aussagen sind gegen den Code geprüft
- [ ] Footer-Link auf allen Seiten, Eintrag in Sitemap und `vercel.json`
- [ ] Lighthouse-A11y ≥ 95 auf den drei Seiten
- [ ] `OFFEN.md` 2.11 aufgeräumt (A3/A5 geprüft)
- [ ] Rechtlich gegengelesen (`legal-reviewer`)
