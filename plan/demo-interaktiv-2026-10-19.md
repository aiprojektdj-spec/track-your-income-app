# Interaktive Demo auf der Landing (Stand 2026-10-19)

**Ziel:** Besucher probieren stackr direkt auf der Landing aus, ohne Whop-Konto. Die Demo sieht
**1:1 aus wie die echte App**, kann aber weniger. Sie ersetzt die statische Vorschau
(„Übersicht · Oktober 2026“) im Hero.

**Vorher gegen den Code prüfen** (CLAUDE.md Regel 3). Dieser Plan beschreibt den Stand von
`20c11be`.

---

## 1. Grundsatzentscheidung: echter App-Code statt Nachbau

| Weg | 1:1-Optik | Wartung | Risiko |
|---|---|---|---|
| **A. Echter Code im Demo-Modus** (empfohlen) | ja, automatisch | keine Drift: jede App-Änderung ist sofort in der Demo | Demo-Modus darf keine echten Daten und keine Server-Endpunkte erreichen |
| B. Statischer HTML-Nachbau | nur am Tag des Baus | jede UI-Änderung doppelt pflegen, veraltet binnen Wochen | gering |
| C. Video/GIF | ja | neu aufnehmen bei jeder Änderung | nicht interaktiv, verfehlt das Ziel |

**Empfehlung: A.** „1:1 wie das Programm“ ist mit B nur kurzfristig zu halten. Das Repo zeigt das
bei Local 1.7, das auseinanderlief, bis die Pflege eingestellt wurde.

## 2. Aufbau (Weg A)

### 2.1 Eigene Seite `demo.html`, nicht `app.html` mit Schalter

- `app.html` bleibt unverändert. **Kein Demo-Flag in `app.html` oder `whop-auth.js`**: Das wäre
  ein Gate-Bypass per URL-Parameter oder DevTools (CLAUDE.md Regel 5).
- `demo.html` lädt dieselben Stylesheets und Module wie `app.html` (Liste aus
  `js/app-loader.js` → `MODULES`), aber **nicht** `whop-auth.js`, `cloud-sync.js`,
  `webhooks.js`, `stb-share.js`, `user-plan.js` (nur der Gate-Teil) und `error-logger.js`.
  Stattdessen kommt ein neues Modul `js/demo-modus.js`.
- Auf der Landing ersetzt ein `<iframe src="demo.html">` die statische Vorschau, oder es gibt
  einen Button „Demo ausprobieren“, der `demo.html` öffnet (siehe offene Frage 1).

### 2.2 `js/demo-modus.js`, die einzige neue Logik

1. **Speicher nur im Arbeitsspeicher.** `Store` (`js/store.js`) schreibt nach
   `localStorage`/IndexedDB unter `<firmenId>__reselling_*`. Im Demo-Modus bekommt `Store` einen
   In-Memory-Adapter. Nichts landet im Browser des Besuchers, und Reload bedeutet frischer Start.
   **Wichtig:** Es darf nie ein echter `reselling_*`-Schlüssel gelesen werden. Wer auf
   derselben Domain angemeldet ist, hat dort seine echte Buchhaltung liegen.
2. **Beispielfirma vorbefüllt:** Musterfirma (Einzelunternehmen, §19 UStG), rund 30 Buchungen
   von Mai bis Oktober, die passen zu den Landing-Zahlen (8.450 € / 2.180 € / 6.270 €),
   2–3 Rechnungen, einige Lagerartikel. Nur erfundene Daten, keine echten Kundendaten.
3. **Gate überspringen nur in `demo.html`:** Die Shell startet direkt mit der Musterfirma.
   Es gibt keinen Token und keinen Aufruf von `/api/whop-*`.
4. **Netzwerk sperren:** eigene CSP-Route für `/demo.html` in `vercel.json` mit
   `connect-src 'none'` (CLAUDE.md Regel 8: pro Route, nie global). Damit kann die Demo
   technisch weder `/api/sync` noch Whop, Make.com oder Supabase erreichen.
5. **Hinweisleiste oben:** „Demo mit Beispieldaten. Nichts wird gespeichert.“ plus Button
   „7 Tage kostenlos testen“ (Whop-Checkout wie auf der Landing).

### 2.3 Eingeschränkte Funktionen

| Bereich | In der Demo | Begründung |
|---|---|---|
| Dashboard, Buchungen ansehen/anlegen/bearbeiten | **ja** | Kernerlebnis |
| Rechnung anlegen, Vorschau ansehen | **ja** | zeigt den größten Nutzen |
| Lager, Statistiken, EÜR-Ansicht | **ja, lesend und schreibend im Speicher** | zeigt Tiefe |
| Export (PDF, DATEV, CSV, XLSX), Drucken, Backup | **nein**: Button sichtbar, öffnet „In der Vollversion“ | sonst ist die Demo ein kostenloses Werkzeug |
| Cloud-Sync, Steuerberater-Freigabe, Webhooks | **nein**: ausgeblendet oder gesperrt | brauchen Server und Konto |
| Beleg-OCR, Bank-Import (Datei-Upload) | **nein** | lädt große Daten oder Dateien, kein Demo-Nutzen |
| Mehrere Firmen, Einstellungen zu Rechtsform/USt | **nur ansehen** | Musterfirma soll konsistent bleiben |
| Obergrenze | z. B. 50 neue Buchungen pro Sitzung | gegen Missbrauch als Gratis-App |

Gesperrte Aktionen laufen über **eine** Stelle in `demo-modus.js`, etwa über `Actions` oder
einen Klick-Abfang auf `[data-export]` usw. Keine Demo-Abfragen verstreut in `app.js`,
`store.js` oder `lager.js` (CLAUDE.md Regel 11). Fehlen dafür einheitliche Hooks, werden sie
zuerst als eigener kleiner Schritt angelegt.

### 2.4 Ehrliche Grenze

Der komplette App-Code ist ohnehin öffentlich abrufbar. Der Demo-Modus macht die App nicht
„knackbarer“, als sie schon ist. Die Hürde, sie dauerhaft gratis zu nutzen, ist
**fehlende Speicherung**, nicht Geheimhaltung. Das ist bewusst so und gehört nicht in ein
späteres Security-Audit als Fund (dann in `plan/02-ENTSCHEIDUNGEN.md` eintragen).

## 3. Landing

- Die statische Vorschau (`.dashboard` in `index.html`) wird durch die Demo ersetzt oder
  verlinkt (offene Frage 1).
- Die Tabelle „Diagrammwerte ansehen“ und die Bildunterschrift sind seit diesem Plan schon
  entfernt. Die Werte stehen für Screenreader im `aria-label` der Vorschau.
- Handy: Die echte App ist auf 375 px nutzbar. Die Demo muss dort trotzdem auf ihre
  Zielbreite geprüft werden, also `iframe`-Höhe und -Scrollen oder Vollbildseite.

## 4. Recht und Datenschutz

- Keine personenbezogenen Daten, kein Speichern: Die Demo braucht **keine Einwilligung**.
  Vercel Web Analytics läuft nur nach dem bestehenden Cookie-Banner.
- Musterdaten deutlich als „Beispieldaten“ kennzeichnen (Irreführungsverbot UWG).
- Keine KI-Funktion in der Demo (CLAUDE.md Regel 12).

## 5. Tests

- Neuer Node-Test `test/test-demo-modus.js`:
  - Der In-Memory-Store liest und schreibt **nie** `localStorage` oder IndexedDB. Dafür
    `localStorage` mocken und Zugriffe zählen.
  - Gesperrte Aktionen lösen kein Download/Print aus.
  - Die Musterdaten ergeben genau die Landing-Kennzahlen.
- `test/test-landing.js` bei Änderung der Vorschau anpassen.
- Browser: frischer Port, Handy (375/360) und Desktop (1366×768), CSP prüfen (Konsole: keine
  blockierten Anfragen außer gewollten).

## 6. Offene Fragen an den User (vor dem Bau klären, Regel 9)

1. **Einbindung:** Demo direkt im Hero eingebettet (`iframe`, sofort sichtbar) oder Button
   „Demo ausprobieren“, der `demo.html` als eigene Seite öffnet?
2. **Umfang:** Stimmt die Tabelle in 2.3? Insbesondere: Rechnung erstellen ja, PDF-Export nein?
3. **Obergrenze:** 50 Buchungen pro Sitzung okay, oder gar keine Grenze?
4. **Musterfirma:** Branche für die Beispieldaten (z. B. Reseller/Vinted wie die eigene
   Zielgruppe, oder neutraler Freelancer)?

## 7. Reihenfolge

1. Fragen aus 6 klären.
2. `Store`-Adapter-Hook (kleinster Eingriff in `store.js`) + Test.
3. `demo.html` + `js/demo-modus.js` + CSP-Route.
4. Musterdaten.
5. Sperren für Export und Server-Funktionen.
6. Landing-Einbindung, Browser-Test, Commit pfad-gescoped.
