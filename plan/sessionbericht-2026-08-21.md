# Sessionbericht — Vollaudit-Abarbeitung (2026-08-11 bis 2026-08-21)

> **Das ist ein Bericht, keine Aufgabenliste.** Was noch zu tun ist, steht **ausschließlich** in
> [`01-AUFGABEN.md`](01-AUFGABEN.md). Diese Datei erklärt, *was gemacht wurde und warum* — und vor
> allem, **was dabei anders war als in den Audit-Fundlisten beschrieben**. Genau dieser Teil geht
> sonst verloren: die Fundlisten sagen, was jemand vermutet hat, nicht was sich beim Anfassen
> herausgestellt hat.
>
> Der Grund für die Trennung steht in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md), Abschnitt 2:
> zwei konkurrierende Listen haben am 2026-08-15 eine ganze Session gekostet, weil acht längst
> erledigte Funde weiter als offen geführt wurden.

**Ausgangspunkt:** [`funde-gesamt-2026-08-10.md`](funde-gesamt-2026-08-10.md) — 49 Funde aus
sechs Audits, später ergänzt um die Audits 07–13 (Product-Manager, Copy/Marketing, Performance,
Steuer-Delta, Compliance, Accessibility, Monetarisierung).

**Ergebnis:** Alle Fundblöcke sind abgearbeitet. `01-AUFGABEN.md` Abschnitt 1 („kann jede Session
machen") war am 2026-08-21 leer; offen ist seither nur, was den Betreiber oder Dritte braucht.

---

## 1. Was gebaut wurde

Gruppiert nach Fundblock, mit den Commits. Alles browserverifiziert, Testsuite bei Abschluss
34 Dateien grün.

### C-Block — UI-Rendering (`fbec939`, `5213dc0`)

`.action-btn` samt vier Modifiern und `.akademie-tip` waren **nirgends definiert**, und
`css/style.css` hatte kein globales `button{}` als Auffangschirm. Ergebnis: 34 Buttons in fünf
Modulen im Browser-Grau, 43 Merkkästen der Akademie als Fließtext. Dazu `aria-label` an allen 34
Icon-Buttons und `.data-table` mit Zweck versehen statt gelöscht (die neun Steuermodule sind
nicht sortierbar, das globale `th{cursor:pointer}` versprach es aber).

### U-Block — die ersten zehn Minuten (`92ed4ea` bis `721497f`)

Zwölf Funde, alle im Einstieg. Die wichtigsten: das Whop-Gate erwähnte den 7-Tage-Trial mit
keinem Wort, obwohl die Landingpage ihn über zwanzigmal nennt und **derselbe Whop-Plan**
dahintersteht. Das Dashboard zeigte nach fünf Wizard-Schritten sechs 0,00-€-Kacheln ohne einen
einzigen Handlungsvorschlag. Die §14-Pflichtangaben wurden erst **beim Speichern** geprüft — nach
Kunde, Datum und allen Positionen, ohne Entwurfssicherung. Dazu Wizard-Skip, Firmenname-Rename,
URL und Tab-Titel, Leerzustände, ELSTER-Folgeschritte und die Akademie-Sortierung nach Branche.

### Performance (`94034de`, `4f7f076`)

Die Defer-Optimierung war nur auf `app.html` angewendet worden; die drei Sub-Apps luden
**20 bis 31 Skripte render-blockierend**. Danach: null. Dazu ApexCharts (~600 KB) entfernt, wo es
gar nicht benutzt wird, `xlsx` (929 KB) und Chart.js (200 KB) auf Lazy-Load.

### M-Block — Landingpage (`0159d4d`, `a3b9b6b`, `7635b2f`)

Sozialbeweis ohne erfundene Kundenstimmen: vier nachprüfbare Belege statt Testimonials.
Wettbewerbs-Preisanker mit Quelle und Stichtag. Modulzahl auf 29 Bereiche, Personas neu geordnet.

### A- und P-Block (`1d44ac6`, `1bf9e0b`)

Die Akademie war **per Tastatur komplett unbedienbar** — null Treffer für `aria-`, `role=` oder
`tabindex` im ganzen Modul. Dazu der Branchen-Einstieg.

### F6 — Krypto-Worker (`185b354`, verdrahtet in `39cf8b1`, Rückmeldung `617bfc3`)

Der größte Einzelposten. Details und die korrigierte Erfolgsprognose in
[`f6-worker-einbau-2026-08-18.md`](f6-worker-einbau-2026-08-18.md).

---

## 2. Wo die Fundlisten falsch lagen

Der wertvollste Teil dieses Berichts. **Fünf Audit-Aussagen haben beim Anfassen nicht gehalten** —
wer die Fundlisten künftig liest, sollte wissen, dass sie Vermutungen enthalten.

### AES-GCM war nicht der Hänger (Performance-Audit, F6)

Das Audit nennt „AES-GCM läuft im Main-Thread; bei mehreren MB ist das ein merklicher Hänger".
Gemessen ist AES-GCM **18–25 %** der Kette; `JSON.stringify` und `TextEncoder` sind zusammen der
größere Posten. Wer nur `crypto.subtle` ausgelagert hätte — also F6 wörtlich umgesetzt — hätte
ein Viertel verschoben und drei Viertel liegengelassen.

### E-Rechnung kostet bei Lexware nicht den XL-Tarif (Audits 03 und 08)

Beide führen „E-Rechnung kostet bei Lexware Office den XL-Tarif (32,90 €)". Am 2026-08-16 direkt
von `lexware.de/preise` geprüft: E-Rechnung ist **ab Tarif L (21,90 € netto)** enthalten. Mit der
32,90-€-Zahl zu werben wäre eine Übertreibung zu eigenen Gunsten und damit angreifbar. Belege in
[`belege-wettbewerbspreise-2026-08-16.md`](belege-wettbewerbspreise-2026-08-16.md).

### Die Foto-Kachel im Lager hatte sehr wohl einen Tastaturpfad (A3)

Das Accessibility-Audit sagt, sie habe „keinen erkennbaren Ersatz". Direkt daneben steht ein
echter `<button>` mit demselben `data-action`. Auch die klickbare Lagerzeile macht exakt dasselbe
wie die Checkbox in ihrer ersten Spalte. In beiden Fällen wäre ein `tabindex` ein **zweiter
Tab-Stopp für dieselbe Funktion** gewesen — für Tastaturnutzer schlechter, nicht besser. Die
echte Lücke lag woanders: in der Foto-Zelle der Bulk-Import-Tabelle.

### „Keine Buchungen gefunden" ist an einer Stelle korrekt (U7)

`js/bank-import.js` beschreibt dort tatsächlich ein leeres **Filterergebnis**. Die Unterscheidung
zwischen leerem Bestand und leerem Suchergebnis *ist* der Fund — nicht „überall einen Button
hinsetzen".

### Der Sync-Punkt brauchte kein Detail, sondern überhaupt einen Unterschied (F6, zweite Hälfte)

Die Aufgabe lautete „sichtbare Rückmeldung während des Syncs". Tatsächlich benutzten die Zustände
`sync` und `ok` **dasselbe Icon in derselben Farbe**; der Unterschied stand nur im
`title`-Attribut und war damit nur beim Hovern zu sehen.

---

## 3. Funde, die in keinem Audit standen

Beim Verifizieren aufgetaucht:

| Fund | Wo | Warum es zählt |
|---|---|---|
| Eingerückter CSS-Block auf oberster Ebene | `css/style.css` ab „Eigenbelege — gemergt" | Sieht aus wie eine Media-Query, ist keine. `.btn{min-height:44px}` galt dadurch app-weit, entgegen dem eigenen Kommentar. Der Block hat jetzt einen Warnhinweis im Kopf |
| Excel-Dateien landeten still im CSV-Zweig | `js/buchungen.js` | Der Guard prüfte `typeof XLSX !== 'undefined'`; fehlte die Bibliothek, wurde die Datei als Müll geparst — **ohne Fehlermeldung**. Durch das Lazy-Loading wäre das der Normalfall geworden |
| `verfahrensdokumentation.html` war von der Landingpage nicht verlinkt | `index.html` | Existiert seit Längerem, war aber nur aus den Rechtstexten erreichbar. Laut Audit einer der Punkte, an denen Stackr den Wettbewerb schlägt |
| Netto gegen brutto in der Vergleichstabelle | `index.html` | Stackrs Bruttopreis stand neben Netto-Spannen der Wettbewerber — die Zeile las sich günstiger, als sie ist |

---

## 4. Ein Fehler, der auf mein Konto geht

**Die Lazy-Load-Umstellung hat den Excel-Import zerlegt.** Zwei `open()`-Methoden in
`lager/page.js` prüften synchron `typeof XLSX === 'undefined'` und brachen ab, bevor der
Nachlade-Schritt in `_handleFile()` überhaupt erreicht wurde. Beide Import-Dialoge ließen sich
nicht mehr öffnen. Gefunden und behoben von einer anderen Session (`8de69cd`).

**Die Lehre:** Bei einer Umstellung von eager auf lazy reicht es nicht, die Verbrauchsstellen zu
suchen — es sind die **Wächter** davor, die brechen. `grep "typeof XLSX"` hätte beide sofort
gezeigt; ich hatte nur nach `XLSX.` gesucht.

**Und eine falsche Zahl:** Ich hatte für F6 „62 % weniger Blockade" gemessen und in Commit und
Plandatei geschrieben. Richtig sind rund 38 %. Der Fehler war der **Rückweg** — ich hatte die Uhr
beim `postMessage` gestoppt und das Promise erst danach abgewartet, sodass der Klon des
zurückkommenden Chiffrats aus der Messung fiel. Korrigiert in `a90ee85`. Bei einem Worker-A/B
endet die Messung erst, wenn das Ergebnis **angekommen** ist.

---

## 5. Was beim Arbeiten wiederholt Zeit gekostet hat

### Warmlauf ist bei Messungen nicht optional

Der erste Lauf war bis zu **fünfmal langsamer** als der eingeschwungene Zustand — einmal 281 ms
für dieselbe base64-Operation, die warm 6 ms braucht. Ohne Warmlauf hätte ich base64 als
Hauptkosten gemeldet und eine völlig andere Empfehlung gegeben.

### Parallele Sessions: prüfen, nicht glauben

Mehrfach hieß es „die Datei ist frei", und `git status` sagte etwas anderes — einmal lagen bereits
107 uncommittete Zeilen darin. Umgekehrt war eine gemeldete Sperre längst aufgehoben. **Immer
selbst nachsehen**, auch wenn eine andere Session es gerade behauptet hat.

Als eine fremde, unfertige Änderung in denselben Dateien lag, half pfad-gescoptes Committen
allein nicht — die fremde Zeile wäre mitgegangen. Lösung: den gewünschten Dateiinhalt über
`git hash-object -w --path` und `git update-index --cacheinfo` in den Index legen, sodass der
Working Tree die fremde Arbeit behält.

### Nach dem Commit gegen HEAD prüfen, nicht gegen den Working Tree

Daran ist `c982264` gescheitert: `js/lager.js` ging raus, die zugehörigen Helfer in `js/utils.js`
blieben liegen. Im Working Tree war alles da und grün, **live war die Lager-Seite tot**. Vor dem
letzten Push dieser Session deshalb: `git archive HEAD` in ein Temp-Verzeichnis und die Testsuite
dort laufen lassen.

### Tests dürfen keinen Wortlaut festnageln

Der R7-Test prüfte auf die exakte Quelltextzeile `if (Date.now() > AAD_FALLBACK_UNTIL) throw e;`.
Beim F6-Umbau wanderte die Sperre in eine Variable — inhaltlich unverändert wirksam, der Test
aber rot. Das sah nach Sicherheitsregression aus und war keine. Neue Tests in dieser Session
prüfen deshalb **Eigenschaften**: „`sync` und `ok` dürfen nicht dasselbe Icon benutzen" statt
„dort steht Icon X". Und: einen Test, den man nicht hat scheitern sehen, ist keiner — die
Gegenprobe gehört dazu.

### Shell-Heredocs zerlegen Sonderzeichen

Zweimal sind Umlaute und deutsche Anführungszeichen beim Einfügen über eine Heredoc verlorengegangen,
einmal auch Backslashes in einem regulären Ausdruck. Längere deutsche Texte deshalb über eine
Datei einspielen, nicht über die Shell — passend zu Projektregel 4.

---

## 6. Entscheidungen, die in dieser Zeit gefallen sind

Vollständig mit Begründung in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). Kurzfassung:

- **29 Bereiche, nicht 28 Module.** „Alles zählen" inklusive Dashboard, und das Wort wechselt —
  die Akademie wirbt zwei Bildschirme weiter mit „9 Module", das waren zwei verschiedene Dinge
  unter demselben Namen.
- **Reseller und GbR nach vorn**, Freelancer ehrlich als drittes Segment. Keine Zeiterfassung.
- **Top-of-Funnel: Demo ausbauen** statt Free-Tier oder Trial ohne Kartenpflicht.
- **OCR wird gebaut**, aber erst **nach** den Live-Tests, und als reine Browser-OCR.
- **CSP-Freigabe für OCR** liegt vor: `'wasm-unsafe-eval'` nur auf `/app.html` und
  `/eigenbelege`. Die Direktive kommt zusammen mit dem Code, nicht vorher.
- **44 px Touch-Targets gelten bewusst auch auf dem Desktop** (WCAG 2.5.5, Level AAA).

---

## 7. Der eine Punkt, der wirklich drängt

**`SYNC_OWNER_IDS` und `WHOP_OWNER_IDS` sind in Vercel nicht gesetzt.** Der Code-Fix zu R3 ist
seit `40e4d83` drin, aber solange die Variablen leer sind, greift der Altweg: der Vergleich gegen
den bei Whop **frei änderbaren Benutzernamen**, mit hart kodiertem Default `'secondlifevintage41'`
in allen drei Endpunkten. Wer sich diesen Namen bei Whop gibt, bekommt Owner-Rechte ohne Abo.

Zehn Minuten, reine Konfiguration, kein Code. Danach die alten `*_OWNER_USERNAMES` löschen.
