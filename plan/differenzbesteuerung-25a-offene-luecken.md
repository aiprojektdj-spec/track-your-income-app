# §25a Differenzbesteuerung — offene Lücken (legal-reviewer, 2026-07-21)

Kein §14c-Blocker, beide Punkte fehlern Richtung Überzahlung (steuerstrafrechtlich ungefährlich),
aber vor breiterem Rollout an die jeweilige Zielgruppe nachzuziehen.

## 1. Pauschal 19% statt möglicher 7%-Sonderfälle

**Wo:** `js/ustvoranmeldung.js` (`_calcPeriode()`, Marge-Berechnung), `js/steuer-berechnung.js`
(`margeEinzeldifferenz`/`margeGesamtdifferenz`, Parameter `satz` wird überall fest mit `19`
aufgerufen).

**Problem:** Bei Kunstgegenständen/Sammlerstücken/Antiquitäten kann nach §25a Abs. 3 UStG i.V.m.
Anlage 2 Nr. 49-53 UStG in bestimmten Fällen der ermäßigte Satz (7%) auf die Marge gelten. v1
rechnet einheitlich mit 19%, unabhängig von der gewählten Warenart. Ein UI-Hinweistext wurde
ergänzt (`lager/page.js`, `js/lager.js`, `rechnungen/js/rechnung.js` — Warenart-Dropdown/Select),
aber es gibt keine echte 7%-Berechnung.

**Risiko:** Kein §14c-Risiko (betrifft nie den Rechnungsausweis, nur die interne UVA-Zahllast).
Fehlerrichtung ist sicher: 19% statt 7% führt zu einer zu hoch erklärten Zahllast, nie zu einer
Untererklärung.

**Fix, falls nötig:** `satz`-Parameter warenartabhängig befüllen (`kunst`/`sammlerstueck` → ggf. 7%,
je nach Einzelfall), erst nach vertiefter Recherche der Anlage-2-Fälle. Dringlich nur, wenn Stackr
aktiv an Kunst-/Antiquitäten-Händler vermarktet wird — aktuelle Zielgruppe (Freelancer/GbR/
Gebrauchtwarenhandel) betrifft das kaum.

## 2. Retouren auf §25a-Positionen nicht gesondert verrechnet

**Wo:** `js/ustvoranmeldung.js` (`_istDiff25aSale`-Filter arbeitet nur auf `Store.getSales()`, nicht
auf `Store.getRetouren()`), `js/euer.js`/`js/gbr-modul.js` (gleiche Lücke in der informativen
Aufschlüsselung).

**Problem:** Wird ein regulär versteuerter Artikel zurückgegeben, zieht der bestehende
`retour19`/`retour7`-Mechanismus ihn korrekt vom Bruttoumsatz ab. Ein §25a-Artikel läuft nicht durch
diesen Pfad — er bleibt in der Marge-Berechnung der ursprünglichen Verkaufsperiode enthalten, auch
wenn er später zurückgegeben wird (es sei denn, der zugrunde liegende Sale wird selbst als
`storniert` markiert).

**Risiko:** Kein §14c-Risiko (kein Rechnungsausweis betroffen). Kann zu einer zu hoch ausgewiesenen
Marge/USt-Schuld führen, wenn die Retoure nach Einreichen der Periode erfolgt — wieder Richtung
Überzahlung, nicht Untererklärung.

**Fix, falls nötig:** §25a-Retouren analog zum bestehenden `retour19`/`retour7`-Mechanismus aus der
Marge herausrechnen (Lookup über `r.saleId` → verknüpfter Sale → verknüpfter Purchase →
`differenzbesteuert`-Flag). Dringlich nur für Nutzer mit regelmäßigen Rückgaben auf
differenzbesteuerte Artikel (z.B. Gebrauchtwaren-Händler mit Rückgaberecht) — für reine
Freelancer-Rechnungsstellung niedrige Eintrittswahrscheinlichkeit.

## Nicht behandelt (bewusst, kein Blocker)

- Bulk-Einkauf/CSV-Import in `lager/page.js` haben keine §25a-UI bekommen (Flag defaultet auf
  `false`, im Edit-Modal nachträglich setzbar).
- Gesamtdifferenz-Vortrag wird nur beim expliziten "Als eingereicht markieren" in der UVA
  persistiert, nicht live — verhindert Verfälschung durch bloßes Seiten-Öffnen, bedeutet aber auch:
  wird eine Periode nie eingereicht, wird der Vortrag nie fortgeschrieben.
