# Stackr — was noch zu tun ist

**Stand 2026-07-30.** Diese Datei ist die *Status*-Liste. `PLAN.md` bleibt das Archiv mit den
ausformulierten Prompt-Texten — dort steht das *Wie*, hier das *Ob noch*.

> **Warum es diese Datei gibt:** `PLAN.md` entstand am 2026-07-27, indem rund 60 Einzeldateien
> wörtlich zusammenkopiert wurden — ohne Erledigt-Markierungen. Sein Inhaltsverzeichnis listet 23
> Prompts unter „Offene Session-Prompts", von denen nur einer als erledigt markiert ist. Nach
> Abgleich mit Code und Memory sind mindestens elf davon längst fertig. Wer `PLAN.md` als
> Arbeitsliste nimmt, arbeitet Erledigtes nach. Diese Datei löst das.

Angaben sind gekennzeichnet: **[geprüft]** = am Code verifiziert · **[Memory]** = aus
Projektgedächtnis übernommen, nicht neu verifiziert.

---

## 1. Aktuell in Arbeit — nicht anfassen

| Wo | Was | Hinweis |
|---|---|---|
| Web, 21 Dateien / 881 Zeilen | Whop-Auth, Blob-Sync, Vorsteuer, Steuermodule | Eine Session arbeitet aktiv daran **[geprüft]** |
| Local, `js/app.js` | uncommittet | **[geprüft]** |

Beide Repos sind ansonsten mit dem Remote gleichauf (`master` bzw. `main`).

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

### 2.2 Rechtstext-Inhalt in Local (D6) **[Memory]**

`Local 1.7/datenschutz.html` beschreibt weiterhin **Supabase + LemonSqueezy**. Tatsächlich läuft
dort Trial + Offline-Lizenz (`js/license.js`). Alle *mechanischen* Teile sind seit 2026-07-28
erledigt (CSP-Meta-Tag, `cookie-banner.js` gespiegelt, `actions.js` ergänzt) — offen ist nur der
Text. Gehört mit dem `legal-reviewer`-Agent angegangen, nicht per Copy aus Web: Web beschreibt
Whop + Vercel Blob + Upstash, was für Local ebenfalls falsch wäre.

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

## 5. Aufräumen

### 5.1 Neun ungetrackte `test-*.js` im Repo-Wurzelverzeichnis **[geprüft]**

```
test-afa-degressiv-linear.js      test-api-sync.js
test-cloud-sync.js                test-ist-uva-gemischte-saetze.js
test-kleinunternehmer-schwellen.js  test-kst-gbr-fixes.js
test-lohnsteuer-ksk-2026.js       test-stb-share.js
test-whop-access.js
```

Keine `.gitignore`-Regel erfasst sie (`git check-ignore` schlägt fehl). Beim nächsten `git add .`
landen sie im Repo. Es sind Wegwerf-Harnesses aus Verifikationsläufen. Entscheidung nötig:
ignorieren, nach `test/` verschieben, oder löschen.

### 5.2 `PLAN.md` Status-Durchgang

Siehe Kasten oben. Die lohnendste Aufräumarbeit: einmal durch die Datei und die erledigten
Abschnitte durchstreichen, so wie es bei `session-prompt-whop-checkout-nachpruefung.md` schon
gemacht wurde.

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
