# Rest offen — Stand 2026-08-09 (nach Sanierungs-Commit)

Nachtrag zu `plan/OFFEN.md` (Stand 2026-07-30) und `plan/stand-technische-sanierung-2026-08-09.md`.
Der dort dokumentierte Zwischenstand ist jetzt committet und gepusht (`980d8b2`,
`origin/master`). Diese Datei listet nur noch, was **danach** übrig bleibt.

---

## 1. Local 1.7 — user-plan.js Fail-Open-Bug (neuer Fund, 2026-08-09)

`js/user-plan.js` war in Local 1.7 (uncommittetes Arbeitsverzeichnis) versehentlich gelöscht —
vermutlich Kollateralschaden einer „Supabase-Reste entfernen"-Aufräumaktion. Drei Seiten
(`lager/index.html`, `rechnungen/index.html`, `eigenbelege/index.html`) binden die Datei aber
weiterhin per `<script>` ein, und alle `UserPlan.*`-Aufrufe in `js/app.js`, `js/companies.js`,
`js/lager.js`, `js/store.js` sind fail-open abgesichert (`typeof UserPlan !== 'undefined'`) —
ohne die Datei liefen Pro-Gate und Buchungslimit auf diesen 3 Seiten also still gar nicht mehr,
statt zu crashen. `js/license.js` (das neue Offline-Lizenzmodell in `app.html`) hat keine
Entsprechung zu `isPro()`/`isTrialActive()`/`requirePro()`/`getLimit()` — kein Drop-in-Ersatz.

**Status:** `js/user-plan.js` lokal wiederhergestellt (`git checkout HEAD -- js/user-plan.js`,
2026-08-09 ~22:26), aber **nicht committet** — in Local 1.7 lief währenddessen nachweislich eine
andere Session parallel weiter (`datenschutz.html`/`js/app.js`/`js/cookie-banner.js` änderten
sich währenddessen). Ob diese Session die Löschung verursacht hat oder sie erneut verursachen
könnte, ist ungeklärt. Details in Memory: `local17-userplan-failopen-bug.md`.

**Nächster Schritt:** vor jedem weiteren Zugriff auf Local 1.7 zuerst `git status` prüfen, ob
`js/user-plan.js` wieder als gelöscht markiert ist.

---

## 2. §25a mit 7% statt pauschal 19% (OFFEN.md §2.1a)

Unverändert offen, bewusst nicht angefasst. `js/steuer-berechnung.js`
(`margeEinzeldifferenz`/`margeGesamtdifferenz`) ruft weiterhin überall fest `satz: 19` auf.
Braucht laut Vorrecherche eine vertiefte Prüfung der Anlage-2-Fälle (§25a Abs. 3 UStG) — eine
Rechtsfrage, kein Code-Fix. Dringlichkeit gering (Kunst-/Antiquitätenhändler, nicht die aktuelle
Zielgruppe).

---

## 3. Wartet auf Dritte / nur der User kann testen

Unverändert gegenüber `plan/OFFEN.md` Abschnitt 3 und 4:

- **Anwalts-Freigabe der Rechtstexte** — AGB §11, §356-BGB-Trial-Klausel, Local-1.7-Rechtstext-
  Inhalt (D6, OFFEN.md §2.2).
- **Whop-DPA / AV-Vertrag** — blockiert die DSGVO-Vollständigkeit.
- **Cloud-Sync mit zwei echten Profilen** — Mock-Test bestanden, echter E2E-Test offen.
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen.
- **StB-Zugang mit zwei Accounts** (Offline-Grace + Read-Only) — Live-Test offen.
- **Lager-Feature-Batch, Punkt 10** — Live-Durchklick offen.

---

## 4. Erledigt in dieser Runde (zur Abgrenzung)

- Web 1.7: 39 geänderte Dateien + 5 neue Test-Harnesses + 3 neue Plan-Docs committet (`980d8b2`)
  und nach `origin/master` gepusht. Alle 14 Test-Harnesses in `test/` grün (140 Assertions),
  keine Regression.
- `plan/OFFEN.md` gegen den committeten Stand abgeglichen — deckt sich bereits, keine Nacharbeit
  nötig.
