**Status: erledigt 2026-07-22** (Fix 1+2 gebaut, Fix 3 nur per Node-Logiktest statt Browser
verifiziert — Whop-Gate blockt Login in Dev-Session). Details: `plan/todo-rest-2026-07-21.md`.

# Prompt für neue Session (copy-paste) — EÜR/Bilanz-Weiche: drei Nachfixes

---

## Kontext

Folgesession zu `plan/session-prompt-euer-umbau.md` (2026-07-21 gebaut: §141-AO-Schwellen-Weiche,
`taetigkeitsart`-Flag, Bilanz-Hinweis in EÜR + GbR-Modul). Beim Abschluss-Review dieser Session
sind drei Restpunkte aufgefallen, die bewusst NICHT mitgebaut wurden (Scope-Disziplin). Diese Datei
bündelt sie für eine eigene Session. Vorher `git status`/`git log` frisch prüfen.

**Nicht Teil dieser Datei:** §25a-Differenzbesteuerung — eigene Datei
`plan/session-prompt-differenzbesteuerung.md`, dort selbst blockiert bis zur
ust-bulletproof-Konsolidierung (`plan/session-prompt-ust-bulletproof.md`). Kein Zusammenhang mit
den drei Punkten hier.

---

## 1. Gewerbesteuer für freiberufliche GbR/EU falsch berechnet

**Fund:** `js/rechtsform.js` hat jetzt `taetigkeitsart` (freiberuflich/gewerblich) für die
§141-AO-Bilanz-Weiche, aber `Rechtsform.FORMEN['Einzelunternehmen']`, `['GbR']`, `['eGbR']` haben
weiterhin hart `gewerbesteuer: true`. Eine als "freiberuflich" markierte GbR (z.B.
Ärzte-/Anwalts-Sozietät) bekommt trotzdem Gewerbesteuer berechnet — fachlich falsch, §18 EStG:
keine Gewerbesteuer für freiberufliche Tätigkeit, unabhängig von der Rechtsform.

**Betroffene Stellen:**
- `Rechtsform.brauchtGewSt(form)` (js/rechtsform.js) — liest aktuell nur `getConfig(form).gewerbesteuer`.
- `GbR.berechneGewSt()` (js/gbr.js) — Gewerbesteuer-Berechnung fürs GbR-Widget.
- `GbrModul._renderGewerbesteuer()` (js/gbr-modul.js) — Gewerbesteuer-Tab im GbR-Modul.

**Bauplan:**
1. `Rechtsform.brauchtGewSt(form)` erweitern: wenn `form` in `FORMEN_MIT_TAETIGKEITSART`
   (`['Einzelunternehmen','GbR','eGbR']`) UND `getTaetigkeitsart() === 'freiberuflich'` →
   `false` zurückgeben, sonst wie bisher `getConfig(form).gewerbesteuer`.
2. `GbR.berechneGewSt()` und `GbrModul._renderGewerbesteuer()` auf `Rechtsform.brauchtGewSt()`
   umstellen statt direkt `getConfig().gewerbesteuer` bzw. eigene Kopie der Prüfung.
3. Browser-Smoke: Testfirma GbR mit `taetigkeitsart='freiberuflich'` → Gewerbesteuer-Kachel zeigt
   0 €. `taetigkeitsart='gewerblich'` → unverändert wie bisher (Regressionstest).

---

## 2. OHG/KG/GmbH & Co. KG werden nie zur Bilanz geschickt

**Fund:** `Rechtsform.FORMEN['OHG']`, `['KG']`, `['GmbH & Co. KG']` haben `bilanzPflicht: true`
(Kaufleute kraft HGB, unabhängig von Umsatz/Gewinn) — aber weder der alte noch der neue
`js/euer.js`-Check fängt das ab. Aktuell blockt nur `Rechtsform.isKapitalgesellschaft()`
(GmbH/UG) den EÜR-Tab. Eine OHG/KG bekommt also klaglos einen EÜR-Report, obwohl sie
bilanzpflichtig ist. **Vorbestehende Lücke**, nicht durch die 2026-07-21-Session verursacht —
das damalige Akzeptanzkriterium nannte nur Kapitalgesellschaften als Regressionstest.

**Bauplan:**
1. `Rechtsform.brauchtBilanzStattEuer(year)` (js/rechtsform.js) um einen dritten Fall erweitern:
   ```js
   brauchtBilanzStattEuer(year) {
       if (this.isKapitalgesellschaft()) return true;
       if (this.getConfig().bilanzPflicht) return true;   // NEU: OHG/KG/GmbH & Co. KG
       return this.istGewerblich() && this.ueberschreitetAO141Schwelle(year || new Date().getFullYear());
   },
   ```
2. `js/euer.js` Hinweistext um einen dritten Fall ergänzen (Handelsgesellschaft kraft Kaufmannseigenschaft,
   nicht Schwellenwert-getrieben) — eigener Text, nicht der §141-AO-Text, da die Begründung
   unterschiedlich ist ("Als Handelsgesellschaft bist du kraft HGB bilanzpflichtig" statt
   §141-AO-Schwellentext).
3. Browser-Smoke: Testfirma als OHG/KG anlegen (auch mit Umsatz = 0 €) → EÜR-Tab zeigt Bilanz-Hinweis
   sofort, nicht erst ab Schwellenwert.
4. Regressionstest: Einzelunternehmen/GbR/eGbR/Freiberufler/Kapitalgesellschaften unverändert.

---

## 3. Browser-Klicktest der 2026-07-21-Session nachholen

Die eigentliche Session konnte wegen Whop-Login-Gate nicht im Browser verifiziert werden (nur
`node -c` Syntax-Check). Beim Bauen der Punkte 1+2 hier gleich mit erledigen:

- Testfirma Einzelunternehmen/GbR, `taetigkeitsart='gewerblich'`, Jahresumsatz > 800.000 € (oder
  Store-Mock) → EÜR-Tab zeigt §141-AO-Bilanz-Hinweis.
- Gleiche Firma unter der Schwelle → EÜR-Tab wie gewohnt.
- Freiberufler-Rechtsform → immer EÜR, unabhängig von Umsatz (auch weit über 800.000 €).
- GbR-Modul-Übersicht zeigt Warn-Banner bei Schwellenüberschreitung, Rest der Seite bleibt nutzbar.

## Akzeptanzkriterien

- Freiberufliche GbR/EU: 0 € Gewerbesteuer, an allen 3 Stellen (Rechtsform-Helper, GbR-Widget,
  GbR-Modul) konsistent.
- Gewerbliche GbR/EU: Gewerbesteuer unverändert wie vor dieser Session (Regressionstest).
- OHG/KG/GmbH & Co. KG: EÜR-Tab blockt sofort (unabhängig von Umsatz/Gewinn), eigener Hinweistext.
- Alle anderen Rechtsformen (Einzelunternehmen/GbR/eGbR unter Schwelle, Freiberufler,
  Kapitalgesellschaften): unverändertes Verhalten.
- `node --check` auf allen geänderten Dateien.
- Browser-Smoke für alle vier Fälle oben durchgeführt (nicht nur statisch geprüft).

## Nach Abschluss

- `plan/todo-rest-*.md` aktualisieren, diese Datei als erledigt markieren.
- Prüfen, ob Local 1.7 diese Änderung ebenfalls braucht (`plan/session-prompt-local-spiegeln.md`).

---

**Modell-Empfehlung: Sonnet 5 reicht.** Drei klar umrissene, kleine Fixes ohne neue
Scope-Entscheidungen — die fachliche Klärung ist bereits in dieser Datei erledigt.
