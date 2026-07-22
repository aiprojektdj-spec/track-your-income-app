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

## Update 2026-07-22: echter Bug gefunden + gefixt (schwerer als Punkt 2 oben)

Bei der Suche nach Punkt 2 fiel auf: `Store.stornoSale()` setzt bei jeder verknüpften Retoure sofort
`storniert=true`, und `Store.getSales()` filtert Stornierte standardmäßig raus — der in Punkt 2
beschriebene Fall (Direktverkauf/Marktplatz-Retoure) war also schon vorher korrekt saldiert, nicht wie
im Text oben unterstellt.

Echtes Problem lag stattdessen bei **§25a-Gutschriften auf Rechnungspositionen**: In
`js/ustvoranmeldung.js` (Zeile ~96-103) wurde bei einer Gutschrift (`sign = -1`) nur der
`verkaufspreis` mit dem Vorzeichen multipliziert, der `einkaufspreis` blieb immer positiv. Bei der
Gesamtdifferenz-Methode (§25a Abs. 4) führte das zu einem doppelten Abzug des Einkaufspreises →
`neuerVortrag` wurde fälschlich negativ (Testrechnung: Verkauf 100/EK 50 + volle Gutschrift ergab
`neuerVortrag: -100` statt korrekt `0`) — das ist **Richtung Unterzahlung**, nicht Überzahlung wie bei
den beiden oben dokumentierten Punkten. Gefixt: `einkaufspreis: sign * (...)` in
`js/ustvoranmeldung.js`. Gleiches Muster (rein informativ, ohne Steuerwirkung) auch in
`js/euer.js` und `js/gbr-modul.js` korrigiert (dort verzerrte es nur die §25a-Anzeige-Kachel, nicht
den tatsächlichen Gewinn/USt).

Verifiziert per Node-Rechenkern-Test (`SteuerBerechnung.margeGesamtdifferenz`): vorher/nachher-Vergleich
bestätigt Fix.

Bei Einzeldifferenz (Standard-Methode) bleibt die strukturelle Lücke bestehen: eine Gutschrift kann
die in einer früheren Periode bereits gezählte positive Marge nicht rückwirkend korrigieren (Floor-bei-0
pro Position verhindert das) — das ist aber immer noch Richtung Überzahlung, kein neuer Risikofall, und
bräuchte ein Redesign (Korrektur am Ursprungs-Datensatz statt neue Position), nicht nur einen
Vorzeichen-Fix. Nicht angegangen, gleiche Priorität wie Punkt 1+2 oben.

## Nicht behandelt (bewusst, kein Blocker)

- Bulk-Einkauf/CSV-Import in `lager/page.js` haben keine §25a-UI bekommen (Flag defaultet auf
  `false`, im Edit-Modal nachträglich setzbar).
- Gesamtdifferenz-Vortrag wird nur beim expliziten "Als eingereicht markieren" in der UVA
  persistiert, nicht live — verhindert Verfälschung durch bloßes Seiten-Öffnen, bedeutet aber auch:
  wird eine Periode nie eingereicht, wird der Vortrag nie fortgeschrieben.
