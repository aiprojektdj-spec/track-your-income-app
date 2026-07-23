# Prompt für neue Session (copy-paste) — Steuer-Audit 2026-07-23: Funde abarbeiten

---

Kontext: Voller Tax-Audit am 2026-07-23, zwei parallele Agenten (`/steuern`-Skill für
Feature-Vollständigkeit, `legal-reviewer` für §-Korrektheit) über die gesamte Steuerlogik.
Vor dem Abarbeiten immer `git status --short` + `git log --oneline -10` frisch prüfen — Repo
hatte in der Vergangenheit mehrere parallele Sessions im selben Ordner.

## Status-Check 2026-07-23 (Update: Fund 1, 2, 3, 4 gefixt + committet)

Fund 1 (>750€-Positionen bei Gesamtdifferenz) und Fund 2 (Retouren-Fehlabzug auf §25a-Sales)
gefixt in `js/ustvoranmeldung.js` — Node-Sanity-Check bestätigt Fund-1-Rechnung (Marge 200+400
statt 200). Stale Kommentar "v1-Lücke" entfernt. Fund 4 (Kassenbuch-Negativsaldo-Warnung)
gefixt in `js/kassenbuch.js` `init()` — Toast-Warnung vor Speichern, kein Hard-Block, globaler
Saldo (nicht datumsgenau, reicht für den Zweck). Fund 3 (KSK/KSA) wurde parallel (andere Session)
in `js/ausgaben.js` umgesetzt — neue Kategorie "Honorare an Künstler/Publizisten", 4,9%-Satz,
1.000€-Freigrenze (§24 Abs.3 KSVG, Freigrenze nicht Freibetrag), Live-Hinweis im Formular +
Summary-Card. Syntax geprüft, inhaltlich nicht von dieser Session verifiziert. Kein Browser-E2E
möglich (Whop-Gate blockt echten Login in Dev-Sessions) — nur Node-Harness + Code-Review.

Noch offen: Fund 5 + Niedrig-Punkte (opportunistisch, kein Zeitdruck).

## 🔴 Hoch — Unterzahlungsrisiko (legal-reviewer)

**1. `js/ustvoranmeldung.js` `_calcPeriode()` Z. 195–204 — §25a-Gesamtdifferenz verliert
Positionen >750€ komplett**

```js
diff25a = SteuerBerechnung.margeGesamtdifferenz(
    diff25aPositionenRoh.filter(p => p.einkaufspreis <= 750), vortrag, 19
);
```

Positionen mit Einkaufspreis >750€ werden gefiltert und laufen nirgendwo anders wieder ein —
keine USt auf diese Verkäufe. §25a Abs. 3+4 UStG erlaubt Gesamtdifferenz nur für Gegenstände
≤750€; Gegenstände >750€ müssen parallel per Einzeldifferenz versteuert werden, dürfen nicht
wegfallen.

Fix: gefilterte >750€-Teilmenge zusätzlich durch `SteuerBerechnung.margeEinzeldifferenz`
schicken und zur Kz.-81-Basis addieren.

**2. `js/ustvoranmeldung.js` Z. 175–187 — Retouren-Schleife zieht §25a-Verkäufe von der
falschen Bemessungsgrundlage ab**

```js
retouren.forEach(r => {
    const linked = r.saleId ? salesById[r.saleId] : null;
    if (linked && linked.storniert) return;
    const rate = _rate(linked || r);   // kein Check auf differenzbesteuert
    ...
    if (rate === 7) retour7 += betrag; else if (rate !== 0) retour19 += betrag;
});
```

Der ursprüngliche §25a-Verkauf ist bewusst nicht in `bruttoUmsatz19/7` enthalten (läuft über
`diff25aPositionenRoh`). Bei Rückgabe zieht diese Schleife den Betrag trotzdem von
`bruttoUmsatz19adj`/`bruttoUmsatz7adj` ab — einer Basis, in der er nie war. Drückt die
Kz.-81/86-Basis der regulären Umsätze künstlich zu niedrig → Unterzahlung auch auf normale
Verkäufe. (Korrektur zur bisherigen Einstufung in `differenzbesteuerung-25a.md`: das ist kein
reiner Überzahlungs-/UX-Punkt.)

Fix: `if (linked && _istDiff25aSale(linked)) return;` vor der Rate-Berechnung ergänzen
(Helper-Funktion `_istDiff25aSale` ggf. neu, prüft das §25a-Flag auf dem Sale).

## 🔴 Hoch — Bußgeld-/Nachzahlungsrisiko (steuern-Skill)

**3. KSK-Modul (`js/ksk.js`) bildet falsche Fallgruppe ab**

Aktuell berechnet `js/ksk.js:9-40` den Beitrag eines KSK-*versicherten* Künstlers (KV/PV/RV,
~50%-Arbeitnehmeranteil). Es fehlt die eigentlich bußgeldrelevante Prüfung: Abgabepflicht für
Unternehmen, die Honorare AN freie Künstler/Publizisten zahlen (§24–§28 KSVG,
Künstlersozialabgabe/KSA). Für Stackr-Nutzer, die z.B. freie Designer/Fotografen/Texter
beauftragen (plausibel bei Reseller-Produktfotos, Grafik), drohen Nachzahlungen +
Säumniszuschläge bei unterlassener KSA-Meldung.

Aktuelle Werte (per WebSearch verifiziert, Stand 2026): KSA-Satz **4,9%** (gesunken von 5,0%
2025), Bagatellgrenze steigt 2026 von 700€ auf **1.000€/Jahr**.

Fix: neues Feld "Honorare an Künstler/Publizisten" in `js/ausgaben.js` (oder passendem Modul)
mit automatischer 4,9%-Abgabepflicht-Berechnung + Bagatellgrenzen-Check (1.000€/Jahr).
Bestehendes `js/ksk.js` (Eigenversicherung als Künstler) ist ein anderes Feature und kann
unverändert parallel bestehen bleiben — ggf. umbenennen/Modul-Namen klären, damit beide Fälle
nicht verwechselt werden.

## 🟡 Mittel

**4. Kassenbuch — keine Negativsaldo-Warnung** (`js/store.js` `saveKassenEintrag` Z. 2556-2567,
`js/kassenbuch.js` Formular-Validierung Z. 159-169 prüft nur `betrag>0`, nicht gegen Bestand)

Negativer Kassenbestand ist ein klassischer Betriebsprüfungs-Indiz für Schätzung. Fix: Warnung
(kein Hard-Block nötig, offene Kasse ist kein TSE-Registrierkassensystem) vor dem Speichern,
wenn laufender Saldo negativ würde.

**5. EÜR Z64-Sammelposten** (`js/euer.js`) — Anlage EÜR hat mehr amtliche Zeilen (Personal,
Raumkosten, Kfz-Kosten etc.) als abgebildet; alles außer Wareneinkauf/AfA/Fahrt landet pauschal
in Z64 "Sonstige Betriebsausgaben". Für reine Reseller/Freelancer ausreichend, bei
Mitarbeitern/Büromiete Steuerberater-Rücksprache nötig. Kein akuter Fix-Zwang, ggf. bei
Zielgruppen-Erweiterung (Mitarbeiter) aufgreifen.

## 🟢 Niedrig

- GWG-800€-Grenze (`js/afa.js:202`) nur Hinweistext, keine automatische
  Sofortabschreibungs-Logik/Checkbox bei AK≤800€ netto.
- `canEdit()`/`canDelete()` High-Level-API nur in `lager.js` genutzt, andere Module rufen
  `Store.isLocked()`/`isPeriodLocked()` direkt — funktional identisch, nur Wartbarkeit.
- Kassenbuch ohne Tages-Gruppierung/-Summe (nur fortlaufende Liste + Jahresfilter).

## Bereits sauber (keine Änderung nötig)

USt-Voranmeldung (Soll/Ist, §19-Grenzen 25k/100k, RC §13b, OSS, UVA-Snapshot-Sperre) und
Belegpflicht/§14 UStG sind laut beiden Agenten die am gründlichsten gebauten Bereiche — keine
Funde. §141-AO-Schwelle 800k/80k (`rechtsform.js:253/254`) korrekt (Viertes
Bürokratieentlastungsgesetz, ab Wirtschaftsjahr 2024). Kz.500-Hinweis und Kz.41/21 pro Position
sind entgegen der alten Projekt-Notiz bereits implementiert — TODO dazu in
`plan/todo-rest-2026-07-21.md` kann abgehakt werden.

## Reihenfolge-Empfehlung

1. Fund 1+2 zuerst (echtes Unterzahlungsrisiko, betrifft laufende UVA-Berechnung)
2. Fund 3 (KSK/KSA) — neues Feld, größerer Scope, ggf. eigene Session
3. Fund 4 (Kassenbuch-Warnung) — klein, kann mitlaufen
4. Fund 5 + Niedrig-Punkte opportunistisch

Nach Fix 1+2: Handrechnung/Node-Harness-Test wie bei vorherigen USt-Fixes (Whop-Gate verhindert
echten Browser-Login in Dev-Sessions), da direkter Eingriff in UVA-Kernberechnung.
