# Stackr — was noch zu tun ist

**Stand 2026-08-09.** Diese Datei ist die *Status*-Liste. `PLAN.md` bleibt das Archiv mit den
ausformulierten Prompt-Texten — dort steht das *Wie*, hier das *Ob noch*.

> **Warum es diese Datei gibt:** `PLAN.md` entstand am 2026-07-27, indem rund 60 Einzeldateien
> wörtlich zusammenkopiert wurden — ohne Erledigt-Markierungen. Sein Inhaltsverzeichnis listet 23
> Prompts unter „Offene Session-Prompts", von denen nur einer als erledigt markiert ist. Nach
> Abgleich mit Code und Memory sind mindestens elf davon längst fertig. Wer `PLAN.md` als
> Arbeitsliste nimmt, arbeitet Erledigtes nach. Diese Datei löst das.

Angaben sind gekennzeichnet: **[geprüft]** = am Code verifiziert · **[Memory]** = aus
Projektgedächtnis übernommen, nicht neu verifiziert.

---

## Kurzfassung: was noch offen ist (Stand 2026-08-09)

Code-seitig ohne Anwalt/User-Login ist alles abgearbeitet. Übrig bleibt:

1. **§25a 7%-Satz (2.1a)** — bewusst nicht angefasst, braucht juristische Recherche zu
   Anlage-2-Fällen, keine Coding-Aufgabe. Geringe Dringlichkeit.
2. **Consent-Banner Local `app.html` (2.2, Frage 1)** — eigene Session, Prompt liegt fertig in
   `plan/session-prompt-local-consent-banner-2026-08-09.md`.
3. **Anwalts-Freigabe** — AGB §11, §356-Trial-Klausel — wartet auf Antwort des Anwalts.
4. **Whop-DPA/AV-Vertrag** — wartet auf Whop.
5. **Vier Live-Tests, nur durch dich machbar** — Cloud-Sync 2-Profil-Test, Make.com-Webhook,
   StB-Zugang 2-Accounts, Lager-Feature Punkt 10 (s. Abschnitt 4).
6. **`ui-politur`** — laut Memory noch „High-End-Politur" am Finanzen-Modul offen, keine
   konkrete Fundliste vorhanden — müsste erst neu aufgenommen werden.

Zusätzlich aktuell in Arbeit von anderen Sessions (nicht anfassen, s. Abschnitt 1):
`agb.html`, `js/whop-auth.js` (Web) sowie `app.html`, `eigenbelege/index.html`, `js/dashboard.js`
(Local) — unklarer Zustand, nicht meiner.

---

## 1. Aktuell in Arbeit — nicht anfassen

| Wo | Was | Hinweis |
|---|---|---|
| Web, `agb.html`, `js/whop-auth.js` | uncommittet | Session "Sanierung 2026 Abschlussbericht" läuft **[geprüft, 2026-08-09 20:31]** |
| Local, `app.html`, `eigenbelege/index.html`, `js/dashboard.js` | uncommittet | nicht zugeordnet, nicht angefasst **[geprüft]** |

**Korrektur eines alten Eintrags:** „Local-Git verwaist" (frühere Memory-Notiz) stimmt nicht mehr —
`Local 1.7` hat inzwischen ein eigenes Git-Repo (`branch main`, aktuell 1 Commit vor `origin/main`,
u.a. `71342b9 AGB-§4: Datenspeicherung-Absatz an echte Architektur angepasst`, `95c43d4
Web-1.7-Sync: Steuer-Berechnung, §25a-Settings, GoBD/USt-Fixes, Companies-Härtung`). Wurde
irgendwann zwischen den Sessions eingerichtet, ohne dass Memory/diese Datei das nachgezogen haben.

**Vor jedem Arbeitsbeginn:** `git status` in beiden Ordnern und `list_sessions` prüfen. Dieses
Repo wird regelmäßig von mehreren Sessions parallel bearbeitet; am 2026-07-26 haben sich zwei
Sessions gegenseitig Dateien überschrieben, bis Dateien vorher zugewiesen wurden.

---

## 2. Offene Code-Arbeit

### 2.1 §25a Differenzbesteuerung — zwei Lücken

Beide fehlern Richtung **Überzahlung**, sind also steuerstrafrechtlich ungefährlich und kein
§14c-Risiko (der Rechnungsausweis ist nie betroffen, nur die interne UVA-Zahllast).

**a) Marge pauschal mit 19% statt möglicher 7%** — weiter offen, bewusst nicht angefasst
**[geprüft]**. `js/steuer-berechnung.js` (`margeEinzeldifferenz`/`margeGesamtdifferenz`, Parameter
`satz`), `js/ustvoranmeldung.js` (`_calcPeriode()`). Bei Kunstgegenständen, Sammlerstücken und
Antiquitäten kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 Nr. 49–53 der ermäßigte Satz gelten. Ein
UI-Hinweistext existiert, eine echte 7%-Berechnung nicht. *Dringlichkeit: gering* — betrifft die
aktuelle Zielgruppe (Freelancer, GbR, Gebrauchtwaren) kaum. Braucht laut Vorrecherche
„vertiefte Recherche der Anlage-2-Fälle" vor der Umsetzung (welche Warenart im Einzelfall
wirklich 7% ist) — das ist eine Rechtsfrage, kein Code-Fix, deshalb nicht blind implementiert.

**b) Retouren auf §25a-Positionen nicht aus der Marge gerechnet — ✅ erledigt 2026-08-09**
**[geprüft]**. Der Lookup-Mechanismus (`r.saleId` → Sale → Purchase, `_istDiff25aSale`) existierte in
`js/ustvoranmeldung.js` bereits (von einer parallelen Session gebaut), war aber wirkungslos: die
Korrektur wurde als `margeKorrektur`-Feld gepusht, das weder `margeEinzeldifferenz` noch
`margeGesamtdifferenz` je gelesen haben, und der `>750€`-Split-Filter hat `margeKorrektur`-Einträge
(ohne `einkaufspreis`) durch beide Filter fallen lassen (`undefined > 750` und `undefined <= 750`
sind beide `false`) — die Korrektur hatte de facto nie eine Wirkung. Per Node-Harness verifiziert
(Bemessungsgrundlage vorher fälschlich 50 statt 0 nach voller Retoure). Fix:
`SteuerBerechnung.margeGesamtdifferenz` liest jetzt `pos.margeKorrektur` mit ein, der Split-Filter
routet `margeKorrektur`-Einträge korrekt in den Gesamtdifferenz-Bucket. `js/euer.js` und
`js/gbr-modul.js` (informative §25a-Kachel, kein Einfluss auf Gewinn/USt) hatten noch gar keine
Retouren-Behandlung — dort direkt den Verkaufspreis der betroffenen Position um den
Erstattungsbetrag gemindert (funktioniert unabhängig vom Einzel-/Gesamtdifferenz-Floor-Problem,
da hier die Original-Position korrigiert wird statt eine neue Ausgleichsposition anzuhängen).
Bei Einzeldifferenz (Standard-Methode) bleibt eine strukturelle Lücke bestehen (§25a Abs. 3
erlaubt keine Verrechnung zwischen Positionen, Floor bei 0 pro Position verhindert eine
rückwirkende Korrektur der UVA) — das ist Gesetzeslogik, kein Code-Bug, und war schon vorher als
bewusst nicht angegangen dokumentiert (`plan/PLAN.md` → `differenzbesteuerung-25a-offene-luecken.md`).

### 2.2 Rechtstext-Inhalt in Local (D6) — ✅ erledigt 2026-08-09 **[geprüft]**

Die alte Prämisse ("beschreibt weiterhin Supabase + LemonSqueezy") war **bereits veraltet** —
per Grep über den ganzen `Local 1.7`-Ordner bestätigt: kein user-facing Text erwähnt Supabase
oder LemonSqueezy irgendwo. `datenschutz.html` beschrieb schon korrekt lokal-only Daten,
ECDSA-Lizenzschlüssel (`js/license.js`, kein Serveraufruf) und Paddle als Merchant of Record
(live verifiziert: echtes Paddle-SDK + Live-Token in `app.html`).

`legal-reviewer`-Agent hat trotzdem eine echte Vollständigkeitsprüfung gemacht (nicht nur die
alte Prämisse abgehakt) und drei reale Lücken gegen den Code gefunden + korrigiert:
- `js/app.js` (DSGVO-Hinweis-Modal) behauptete fälschlich "keine externen Ressourcen" —
  tatsächlich lädt `app.html` sechs CDN-Skripte (GSAP, Notyf, Flatpickr×2, QR, ApexCharts,
  Paddle.js) unconditional beim Start.
- `js/cookie-banner.js` sprach von Cookies "für Anmeldung/Session" — Local hat aber weder
  Login noch Server-Session (Rest aus der Web-1.7-Variante übernommen).
- `datenschutz.html`: neuer Abschnitt zu den CDN-Bibliotheken, Klarstellung dass Paddle.js
  schon beim App-Start lädt (nicht erst beim Kauf), Art. 13 Abs. 2 lit. f-Standardsatz zu
  automatisierter Entscheidungsfindung ergänzt.

Trial-Mechanik-Frage (Grund für den ursprünglichen "Trial + Offline-Lizenz"-Vermerk) geklärt:
Es gibt **keine funktionierende Trial-Mechanik** in Local — `UserPlan` wird an 8 Stellen
referenziert, ist aber nirgends definiert (toter Code, wohl unverändert aus Web 1.7 kopiert,
jede Prüfung `typeof UserPlan !== 'undefined'` ist permanent `false`). Einziger echter
Trial-ähnlicher Mechanismus ist der Demo-Lizenzschlüssel `OYI-DEMO-90-DAYS` (90 Tage,
regulärer `app_license`-Eintrag) — bereits korrekt in §2.2/§3 abgedeckt, keine Textänderung nötig.

**Offene Fragen — Entscheidungen 2026-08-09:**
1. Echter Consent-Banner vor dem Laden der CDN-Skripte (inkl. Paddle.js) in `app.html` — auf
   eigene Session verschoben, ausformulierter Prompt in
   `plan/session-prompt-local-consent-banner-2026-08-09.md`.
2. Aufsichtsbehörde namentlich nennen — ✅ erledigt: LfDI Baden-Württemberg (Königstraße 10a,
   70173 Stuttgart) in `datenschutz.html` §7 ergänzt.
3. Setzt Paddle.js beim bloßen Laden eigene Cookies/Storage zur Betrugserkennung? Weiterhin offen,
   Teil des Consent-Banner-Prompts oben (Punkt 1 dort).

Nebenbefund, außerhalb des Scopes nicht angefasst: `js/app.js:218` enthält toten, wirkungslosen
`SupabaseDB`-Code (durch `typeof`-Guard nie ausgeführt) — reiner Cleanup-Kandidat, keine
Rechtstext-Relevanz.

### 2.3 EU-ODR-Verweis in beiden Impressen — ✅ erledigt 2026-08-09 **[geprüft]**

`impressum.html` in Web *und* Local verwies auf die EU-Online-Streitbeilegungsplattform, die zum
**20.07.2025 eingestellt** wurde. Recherche (it-recht-kanzlei.de, wbs.legal, dhz.net) bestätigt:
Löschpflicht betrifft nur den Plattform-Hinweis/Link, der separate §36-VSBG-Nichtteilnahme-Satz
bleibt unverändert gültig — reine Streichung, keine neue Rechtsformulierung nötig. In beiden Dateien
entfernt.

---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe der Rechtstexte** — AGB §11, Trial-/Widerrufsklausel (§356 BGB), dazu Punkt 2.2
  (Local Rechtstext-Inhalt D6). Punkt 2.3 (EU-ODR) ist erledigt, keine Anwaltsfrage mehr.
- **Whop-DPA / AV-Vertrag** — seit Längerem offen, blockiert die DSGVO-Vollständigkeit.

---

## 4. Nur du kannst das testen

Diese Punkte sind gebaut und committet, aber nie unter echten Bedingungen gelaufen — sie brauchen
echte Logins, zwei Accounts oder externe Dienste:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen) **[Memory]**
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen **[Memory]**
- **StB-Zugang mit zwei Accounts** (Offline-Grace + Read-Only) **[Memory]**
- **Lager-Feature-Batch, Punkt 10** — Live-Durchklick **[Memory]**

---

## 5. Aufräumen — beide Punkte ✅ erledigt

### 5.1 Test-Harnesses — ✅ erledigt (Commit `b11dcbb`) **[geprüft]**

Alle `test-*.js` liegen jetzt in `test/`, nichts mehr ungetrackt im Repo-Root (14 Dateien
inzwischen, weitere aus der technischen Sanierung dazugekommen).

### 5.2 `PLAN.md` Status-Durchgang — ✅ erledigt 2026-08-09 **[geprüft]**

19 abgeschlossene Session-Prompt-Abschnitte durchgestrichen (Überschrift `~~...~~` + Verweis auf
diese Datei), analog zu `session-prompt-whop-checkout-nachpruefung.md`.

---

## 6. Erledigt — nicht nochmal anfangen

Diese Abschnitte stehen in `PLAN.md` noch unmarkiert unter „offen", sind es aber nicht:

| Abschnitt | Stand |
|---|---|
| `ch-at-entfernen` | Web bereinigt 2026-07-16, CH bleibt in Local (Entscheidung D1) **[Memory]** |
| `local-sync-fortsetzung`, `local-sync-punkte-16-22`, `local-sync-backlog` | alle 21 Punkte fertig, nur D6-Text offen **[Memory]** |
| `teilzahlung-ratenzahlung`, `zufluss-teilzahlung-steuermodule` | committet `e771cdb` **[geprüft]** |
| `whop-checkout-nachpruefung` | erledigt 2026-07-30, als einziges markiert **[geprüft]** |
| `onboarding-rebuild` | Firmenname-Label committet `4949b31` **[geprüft]** |
| `lager-feature-batch` | bis auf Live-Test fertig **[Memory]** |
| `offline-grace-stb`, `stb-gate-revoke`, `stb-luecken` | gebaut; Revoke-Logik in `js/stb-share.js` vorhanden **[geprüft]** |
| `blob-sync`, `vercel-blob-empfaenger` | `api/blob-upload.js` + `js/blob-attachments.js` existieren **[geprüft]** |
| `landing-seo` | Meta-Description, Canonical, OG-Tags, `robots.txt`, `sitemap.xml` vorhanden **[geprüft]** |
| `persona-cta-touch-target` | 44px-Touch-Targets in `css/style.css` **[geprüft]** |
| `performance-a11y` | 63 `defer`-Scripts in `app.html`, A11y-Vollaudit abgeschlossen **[geprüft]** |
| `makecom-webhook` | committet `4cbd40d`, nur Live-Test offen **[Memory]** |
| `rechnung-eigenbeleg-vollaudit`, `vollaudit-a11y-rest` | alle Funde abgearbeitet **[Memory]** |

`ui-politur` ist der einzige aus dieser Gruppe, der laut Memory noch echte Restarbeit hat
(„High-End-Politur" am Finanzen-Modul) — ohne konkrete Fundliste.

---

## Zwei Fallen, die wiederholt Zeit gekostet haben

**Browser-Cache.** `python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am
Origin. `location.reload()`, Cache-Bust-Query **und ein neuer Tab** liefern trotzdem alten Code —
man verifiziert dann den Vorher-Zustand und hält einen ungefixten Bug für gefixt. Einzig
zuverlässig: **neuer Port** in `.claude/launch.json`. `eval` zum Nachladen scheitert an der CSP.
Für reine Rechenlogik ist ein Node-`vm`-Harness schneller und cache-immun.

**Drift läuft in beide Richtungen.** Local ist bei der Input-Härtung (`maxlength`, `min`/`max`,
`Number.isFinite`, teils `Utils.escapeHtml`) an vielen Stellen *voraus*. Blindes Kopieren Web→Local
löscht sie. Prüfregel nach jedem Modul: `diff --strip-trailing-cr Local Web | grep '^>'` darf nur
Zeilen zeigen, in denen *Web* eine Härtung fehlt — alles andere ist ein unportiertes Feature.
