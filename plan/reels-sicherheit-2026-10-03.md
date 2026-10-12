# Reels: Sicherheits-Takeaways für Stackr (03.10.2026)

Reel-Zusammenfassung und CFC-Abgleich: `Desktop/CFC/wertenetz-mvp/docs/REELS_SICHERHEIT_2026-10-03.md`.
Hier nur der Abgleich gegen Stackr – Code `master` (`6494b23`) **und** Live-Seite
https://track-your-income-app.vercel.app (läuft auf `origin/master` = `4636084`, 18.09.).

## Reel 1 – „20 Sachen, wegen denen eine mit KI gebaute Seite offen liegt"

https://www.instagram.com/reel/DdUQ5NQP6MA/ (@titusharmann): Schlüssel im Browser, Datenbank
ohne Zugriffsregeln, Preis aus dem Browser, KI-Aufruf ohne Kostendeckel – 20 Punkte, unten
einzeln abgeglichen.

## 🔴 Sofort: Interne Doku ist live öffentlich

Live am 03.10. abgerufen, HTTP 200:
- `/CLAUDE.md`
- `/plan/00-STAND.md` (8203 Byte = lokale Datei)
- `/plan/funde-audit-01-red-team-2026-08-10.md` – der komplette Red-Team-Bericht mit
  Angriffspfaden

`origin/master` enthält 155 solcher Dateien (`plan/`, `compliance/`, `test/`, `scripts/`, `*.md`).
Secret-Scan darüber: **keine Schlüssel/Tokens**, „nur" Architektur, Audit-Funde und
Angriffsszenarien – trotzdem genau die Landkarte, die ein Angreifer will.

**Ursache:** Der Fix existiert, ist aber nie live gegangen. `67fc5c5` („plan/, Tests, Skripte und
alle .md-Dateien nicht mehr oeffentlich", `.vercelignore`) liegt **nur lokal**. `master` ist
**11 Commits vor `origin/master`**, darunter auch:
- `e85fda6` XSS-Härtung (letzte unescapte Nutzerwerte in `innerHTML`)
- `f6bbb77` console.log-Bereinigung
- `40a78d8`/`c9e631e`/`6494b23` Health, JSON-Logs, `/api/client-error`

### R1 – Pushen und live verifizieren
- [ ] Vor dem Push: `git status` – fremde, uncommittete Änderungen bleiben draußen (nur die 11
      Commits gehen raus). Push-Credential-Problem siehe Memory `git-push-credential-403`
- [ ] `git push origin master`, Vercel-Deploy abwarten
- [ ] Live prüfen (Browser, nicht curl-Salve – sonst greift der Vercel Security Checkpoint):
      `/CLAUDE.md`, `/plan/00-STAND.md`, `/test/`, `/compliance/`, `/build-deploy.py` → 404
- [ ] Prüfen, ob alte Deployments per eigener URL (`*-hash.vercel.app`) die Dateien weiter
      ausliefern → in Vercel „Deployment Protection" für Nicht-Production-URLs aktivieren oder
      alte Deployments löschen
- [ ] Da der Red-Team-Bericht öffentlich war: alle dort als **offen** markierten Funde jetzt
      vorrangig schließen bzw. bestätigen, dass sie zu sind

## Abgleich mit Stackr

Legende: ✅ erledigt · ⚠️ offen/teilweise · 🔴 kritisch · ➖ nicht relevant · 🟡 bewusst akzeptiert

| # | Punkt aus dem Reel | Status | Fundstelle / Befund | Maßnahme |
|---|---|---|---|---|
| 1 | Kein Limit | ✅ | Rate-Limits in `sync`, `blob-upload`, `whop-access/-token/-refresh`, `client-error` (Upstash) | – |
| 2 | Kein Kostendeckel | ⚠️ | Kein KI-Aufruf: Belegerkennung läuft lokal (Tesseract in `js/vendor`). Blob-Byte-Budget existiert, Default aber **10 GB je Nutzer und Fenster**. Rate-Limits und Budget sind **fail-open** bei Redis-Ausfall (mit Alert). Vercel-Spend-Limit nicht dokumentiert | **R3** |
| 3 | Schlüssel im Browser | ✅ | Kein Server-Secret im Client-JS; `BLOB_READ_WRITE_TOKEN` nur als Kommentar in `js/blob-attachments.js:178` | – |
| 4 | Admin-Schlüssel | ✅ | Upstash-/Blob-/Whop-Secrets nur in `api/` (Vercel-Env) | – |
| 5 | Passwortdatei offen | ✅ | Live: `/.env`, `/.env.local`, `/.git/config`, `/package.json`, `/vercel.json`, `/.vercel/project.json` → 404 | – |
| 6 | Admin ohne Passwort | ➖ | Kein Admin-Bereich | – |
| 7 | Datenbank ohne Regel | ✅ | Kein offenes DB-Backend; Redis-/Blob-Keys serverseitig an die Whop-User-ID gebunden (Red-Team 08-10 bestätigt) | – |
| 8 | Tabellen für jeden | ✅ | wie 7 | – |
| 9 | Preis aus dem Browser | ✅ | Client verlinkt nur `whop.com/checkout/plan_…`; Preis setzt Whop, Freischaltung prüft `api/whop-access` serverseitig | – |
| 10 | Login tut nur so | ✅ | Gate gegen `api/whop-access`; Offline-Grace nur mit server-signiertem Token (`_verifyGraceToken`) | – |
| 11 | Daten im Browser | 🟡 | Buchhaltungsdaten local-first im Browser, unverschlüsselt (Konzept); Cloud nur Chiffrat. Whop-Access-Token liegt in `localStorage` (`js/whop-auth.js:109`) – bei XSS abgreifbar, abgefedert durch CSP `script-src 'self'` | XSS-Fix live bringen (**R1**) |
| 12 | Webhook nachbaubar | ➖ | Kein eingehender Webhook (nur ausgehende Alerts/make.com) | – |
| 13 | Abfrage kaperbar | ✅ | Keine SQL-DB; Redis-Keys aus Token-User-ID abgeleitet, nicht aus Request | – |
| 14 | Formular ohne Bremse | ✅ | `client-error`: 4 KB Body-Limit + IP-Rate-Limit. Weitere öffentliche Formulare gibt es nicht | – |
| 15 | Quelltext dabei | 🔴 | Siehe oben: `plan/`, `*.md`, `test/`, `scripts/` live. Source-Maps: nur Verweise in `js/vendor` (Chart, Tesseract) ohne `.map`-Datei – harmlos | **R1** |
| 16 | Ordner für jeden | 🔴 | wie 15 | **R1** |
| 17 | Fehlerseite verrät | ✅ | `err.message` geht nur an Betreiber-Alerts/Logs, nie in Antworten | – |
| 18 | Cookies ohne Schutz | ➖ | Stackr setzt keine Cookies (Token in `localStorage`, siehe 11) | – |
| 19 | Unverschlüsselt | ✅ | HTTP → 308, HSTS `max-age=63072000; includeSubDomains; preload`, strikte CSP | – |
| 20 | Zertifikat abgelaufen | ✅ | Gültig bis 27.11.2026, Vercel verlängert automatisch | – |

## Umsetzen

### R1 – Pushen und live verifizieren (oben) · 🔴 heute

### R2 – Regression verhindern: Live-Check nach jedem Deploy
Der Kommentar in `.vercelignore` sagt „nach jedem Deploy prüfen" – das passiert offensichtlich
nicht von selbst. Daher automatisieren:
- [ ] `scripts/check-live-exposure.js`: ruft gedrosselt (≥ 1 s Abstand) eine feste Liste ab –
      `/CLAUDE.md`, `/plan/00-STAND.md`, `/test/`, `/scripts/`, `/compliance/`,
      `/build-deploy.py`, `/.env`, `/.git/config`, `/package.json` – erwartet 404; prüft
      HSTS/CSP/X-Frame-Options auf `/` und `/app.html`. 403 mit „Vercel Security Checkpoint"
      zählt als **unbestimmt**, nicht als Erfolg
- [ ] Als GitHub-Action nach dem Vercel-Deploy (`deployment_status`) oder täglich per Cron;
      bei Fehler Alert über den vorhandenen `ALERT_WEBHOOK_URL`-Weg
- [ ] Zusätzlich: Hinweis in `CLAUDE.md`, dass ein Fix erst als erledigt gilt, wenn er auf
      `origin/master` **und** live verifiziert ist (genau das ist hier schiefgegangen)

### R3 – Kostendeckel
- [ ] Vercel Spend Management: harte Grenze + Benachrichtigung
- [ ] Upstash: Budget/Max-Requests im Dashboard setzen
- [ ] `BLOB_MAX_BYTES` bewusst wählen statt 10-GB-Default (Bedarf eines Nutzers realistisch
      eher < 1 GB) – Entscheidung in `plan/02-ENTSCHEIDUNGEN.md`
- [ ] Fail-open der Limits bleibt (Verfügbarkeit vor Härte), ist aber dort zu dokumentieren

### Bewusst akzeptiert (in `02-ENTSCHEIDUNGEN.md` eintragen, falls noch nicht da)
- Local-first-Daten unverschlüsselt im Browser (Punkt 11) – Kernkonzept; Schutz ist Gerät + CSP
- Access-Token in `localStorage` statt HttpOnly-Cookie – Umbau nur, falls die CSP je
  aufgeweicht wird

Vorhandene Werkzeuge: `/security-stackr`, `/red-team`, `plan/security-fix-2026-09-29.md`.

---

## Reel 2 – „Wenn du deine App mit Claude Code baust, drohen dir Strafen bis zu 10.000 €"

[dennisbayo.ai, 25.08.2026](https://www.instagram.com/reel/DceKrr5s8ec/). Takeaways und die
Korrektur zur 72-h-Frist (sie läuft ab **Kenntnis**, nicht ab dem Vorfall) stehen in der
CFC-Datei unter „Reel 2". Hier steht nur der Abgleich mit Stackr.

| # | Punkt aus dem Reel | Status | Befund | Maßnahme |
|---|---|---|---|---|
| 1 | DB-Schlüssel im Frontend | ✅ | `js/` und `*.html` enthalten keine Secrets. Upstash, Blob und Whop-Secret liegen nur in `api/` (Server-Env). Die Treffer in `js/vendor/tesseract-*.wasm.js` sind Binärdaten, keine Schlüssel | **C3** sichert das dauerhaft ab |
| 2 | 72 h Meldefrist bei Datenpanne | ⚠️ | Alarm-Technik ist da (`api/_alert.js`, Heartbeat). VVT liegt in `compliance/`. Es fehlt der **Ablauf danach**: Frist, Behörde, Meldetext, Vorfall-Log | **C1** |
| 3 | KI-Hinweis (AI Act Art. 50) | ➖ | Kein KI-Dienst angebunden. Beleg-OCR läuft lokal mit `tesseract.js` (`js/beleg-ocr.js`). Das ist kein Chatbot und erzeugt keine KI-Inhalte | **C2** (Regel für später) |
| 4 | Abmahnung | 🟡 | Rechtsseiten vollständig, kein Google Fonts/Tracking. Kündigung über „Abo verwalten / kündigen" in der App + Whop (`agb.html:122-128`). Offen: Reicht das für § 312k BGB, wenn Whop Vertragspartner ist? CFC hat zusätzlich `/kuendigen` | **C4** |

**Besonderheit Stackr:** Steuer- und Belegdaten liegen lokal oder **Ende-zu-Ende verschlüsselt**
in der Cloud. Bei einem Leck der Cloud-Daten entfällt die Benachrichtigung der Nutzer dann oft
(Art. 34 Abs. 3 lit. a DSGVO). Die Meldung an die Behörde und das Vorfall-Log bleiben
trotzdem Pflicht. Das gehört so in den Ablauf, sonst wird im Ernstfall falsch entschieden.

### Umsetzen

#### C1 – Datenpannen-Ablauf `compliance/datenpanne.md` (Doku, ~1 h)
Gleicher Aufbau wie CFC B1, angepasst:
- [ ] Stunde 0 = Kenntnis (auch: Alarm-Mail aus `api/_alert.js`, Meldung von Vercel/Upstash/Whop).
- [ ] Schlüssel-Rotation: `UPSTASH_*`, `BLOB_READ_WRITE_TOKEN`, Whop-Client-Secret, `CRON_SECRET`.
- [ ] Bewertung inkl. E2E-Frage: Waren die betroffenen Daten verschlüsselt und der Schlüssel
      nicht betroffen? → Begründung festhalten.
- [ ] Behörde: **LfDI Baden-Württemberg**, Online-Formular. Meldetext-Vorlage (Art. 33 Abs. 3).
- [ ] Vorfall-Log-Tabelle. Verweis aus `compliance/verzeichnis-verarbeitungstaetigkeiten.md`
      (TOM-Abschnitt) und aus `plan/03-ARBEITSREGELN.md`.

#### C2 – Regel 9 für KI-Features in `CLAUDE.md` (5 min)
- [ ] „Kein externer KI-Dienst ohne Rückfrage. Kommt einer dazu: KI-Hinweis vor der ersten
      Interaktion (AI Act Art. 50), AVV + Datenschutzerklärung, keine Steuerdaten an die KI
      ohne ausdrückliche Einwilligung. Die OCR bleibt lokal."

#### C3 – Test gegen Secrets im ausgelieferten Code (Code, ~30 min)
- [ ] `test/test-no-secrets-client.js`: durchsucht `js/**` (ohne `js/vendor/`) und `*.html`
      nach `sk_`, `whsec_`, `UPSTASH`, `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_TOKEN` + Wert,
      langen JWTs. Läuft in der CI mit, sobald die gepusht ist (siehe Reel 1).

#### C4 – Kündigungsbutton klären (Frage an Anwalt, keine Umsetzung auf Verdacht)
- [ ] In die Liste für den Anwaltstermin (`compliance/anwaltstermin-compliance-paket-*.md`):
      Muss Stackr selbst einen § 312k-Button „Verträge hier kündigen" ohne Login anbieten,
      obwohl der Vertrag über Whop läuft? Falls ja: Seite wie CFC `/kuendigen` übernehmen.

## Stand 04.10.2026

- [x] UptimeRobot: alle 5 Monitore aktiv und grün (CFC `/api/health`, CFC Startseite mit Keyword, `www.christianfoundersclub.de`, Stackr `/api/health`, Stackr Startseite), Intervall 5 Min., Alarm per E-Mail. Die Testbenachrichtigung wurde ausgelöst.
- [ ] Heartbeats bei healthchecks.io, Branch-Schutz, Push-App von UptimeRobot
