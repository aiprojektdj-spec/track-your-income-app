# Betragsregel: drei offene Fehler — gefunden 2026-08-30

**Nicht behoben, bewusst.** Alle drei sind an der ausgelieferten Fassung von
[`js/beleg-ocr.js`](../js/beleg-ocr.js) reproduziert, keiner ist theoretisch. Sie stehen hier
statt im Code, weil die Betragsregel am selben Tag bereits eine neue Regel bekommen hat
(die Konsens-Gegenprobe, [Abschnitt 5a](ocr-belegerkennung-2026-08-12.md)) — und die steht auf
**genau einem** echten Bon. Vier neue Regeln auf n = 1 wären Raten mit Nachkommastellen.

**Was zuerst passieren muss:** mehr echte Bons messen (Barbon, Retoure, Gastro, Tankstelle).
Danach lässt sich der Rückfallpfad in einem Stück umbauen, statt ihn dreimal einzeln zu
flicken.

Zwei der drei kamen aus einer Parallel-Session (`web-1-7-19`), der dritte fiel beim Nachprüfen
ihrer Gegenbeispiele auf — er stand dort als Fall, der „sauber durchläuft".

---

## Der gemeinsame Nenner

Alle drei hängen am selben Ast: **sobald die Schlüsselwortzeile nicht greift, ist der Rückfall
„größter Betrag" ungeschützt.** Und alle drei irren **nach oben** — in Richtung zu hoher
Betriebsausgabe und zu hohem Vorsteuerabzug. Das ist dieselbe Fehlerrichtung wie beim
gemessenen `785,90`-Fund, nur über einen anderen Weg.

Die Konsens-Gegenprobe fängt keinen davon: sie braucht einen widersprechenden Zweitkandidaten,
und den gibt es in diesen drei Fällen nicht.

---

## Fund 1 — `SUMME` steht allein, der Betrag eine Zeile tiefer

Auf schmalen Thermobons bricht die Summenzeile um. Der Bon:

```
2 x Kaffee      7,98
SUMME
        12,47
Geg. BAR  20,00
Rueck      7,53
```

**Ergebnis `20,00` statt `12,47`** — also das hingelegte Bargeld. `ausSummenzeilen` bleibt leer,
weil die `SUMME`-Zeile selbst keinen Betrag enthält; es fällt auf „größter Betrag" zurück.

Das ist der teuerste der drei: er trifft **jeden Barbon mit Umbruch**, und er hebelt ausgerechnet
den Fall aus, für den die Summenregel gebaut wurde („Gegeben 50,00 darf nicht gewinnen").

> **Lösungsrichtung** (nicht gebaut): matcht eine Summenzeile ohne eigenen Betrag, die nächsten
> ein bis zwei nichtleeren Zeilen mitnehmen. Als Netz darunter `Geg.`/`Gegeben`/`BAR`/
> `Rueckgeld`/`EC`/`Karte` als Ausschlusszeilen führen. **Vorsicht:** `EC`/`Karte` tragen auf
> Kartenbons oft den *richtigen* Betrag (auf dem Bauhaus-Bon steht er als `Betrag EUR 85,90`) —
> ein pauschaler Ausschluss würde dort schaden. Der Ausschluss gehört an den Rückfall, nicht an
> die Bestätigung.

## Fund 2 — negative Beträge verlieren das Vorzeichen

```
MediaMarkt
Ruecknahme
Artikel        -49,99
SUMME          -49,99
```

**Ergebnis `49,99` statt `-49,99`.** `RE_BETRAG` verlangt vor der Zahl ein Nicht-Ziffer-Zeichen
und verschluckt das Minus dabei. Aus einer **Erstattung wird eine Ausgabe** — der Vorzeichenwechsel
ist genau das, was beim Übernehmen eines Chips niemand nachrechnet.

Weniger dringend als Fund 1, weil eine Retoure als Eigenbeleg seltener ist als ein Barkauf. Aber
die Fehlerrichtung ist dieselbe, und der Betrag ist doppelt falsch (Vorzeichen *und* Wirkung).

> **Verschärfung, von `web-1-7-79` beim Gegenprüfen bemerkt:** der Treffer kommt mit
> `bestaetigt: true` durch. Die Summenzeile trägt ja das Schlüsselwort, und der Betrag daneben
> stimmt betragsmäßig sogar — es fehlt nur das Vorzeichen. Ein Vorschlag, der intern als
> bestätigt gilt und dem Nutzer eine plausible Zahl zeigt, wird beim Übernehmen erst recht nicht
> hinterfragt. Die Konsens-Gegenprobe verlässt sich auf dieselbe Markierung; ein Fix am
> Vorzeichen muss deshalb an `RE_BETRAG` ansetzen, nicht an der Bestätigung.

## Fund 3 — Uhrzeit mit Punkt wird als Betrag gelesen

```
Datum 12.03.2026
Uhrzeit 07.45
Kaffee 2,40
```

**Ergebnis `7,45` statt `2,40`.** `07.45` hat zwei Nachkommastellen und nichts hinter sich —
formal ein Betrag. Die bestehende Datumsabwehr greift nicht: sie erkennt `12.03` an dem
`.2026` dahinter, aber eine Uhrzeit hat keinen dritten Teil.

Der bestehende Test deckt nur die Doppelpunkt-Schreibweise ab (`14:33`), und die ist
unproblematisch. **Mit** erkannter Summenzeile stimmt das Ergebnis wieder (`2,40`) — der Fehler
lebt ausschließlich im Rückfall.

> Die Uhrzeit mit Punkt ist im deutschen Kassendruck nicht exotisch. Auf dem gemessenen
> Bauhaus-Bon stand sie zwar als `11:36:32`, aber das ist keine Verallgemeinerung.

---

## Was ausdrücklich in Ordnung ist

Beim Nachprüfen mitgelaufen und korrekt:

| Fall | Ergebnis |
|---|---|
| `TOTAL EUR 23,45` neben Terminal-ID `88123456` und Beleg-Nr. `4711` | `23,45` |
| Gastro mit zwei Summenzeilen (`SUMME 34,50` / `Trinkgeld 3,50` / `Gesamt 38,00`) | `38,00` |
| Uhrzeit `14:33` mit Doppelpunkt hinter dem Datum | `3,99` |
