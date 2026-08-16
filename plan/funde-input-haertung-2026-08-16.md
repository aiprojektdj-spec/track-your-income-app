# Input-Härtung — die systematische Erhebung

**Stand: 2026-08-16**, maschinell über alle HTML- und JS-Dateien erhoben und danach von Hand
gegen den Code triagiert. Einstieg: [`00-STAND.md`](00-STAND.md)

Warum diese Datei existiert: [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) hält fest, dass Local
1.7 bei `maxlength` / `min` / `max` / `Number.isFinite` an einigen Stellen voraus war, dass das
seit der Local-Einstellung ein **eigenständiger Web-Fund** ist — und dass es *„systematisch
erhoben nie wurde"*. Das ist hiermit nachgeholt.

**Erhebungsbasis:** 90 Dateien, 474 `<input>`-Tags (108 × `number`, 219 × textartig).
Ausgeschlossen: `js/vendor/`, `test/`, `node_modules/`, `.claude/worktrees/` (Klon, verdoppelt
sonst jede Zahl), `graphify-out/` (generiertes Artefakt, kein App-Code).

---

## Zusammenfassung

| Kategorie | Roh | Nach Triage echt |
|---|---|---|
| `number` ohne `min` | 13 | **11** |
| `number` ohne `max` | 31 | **28** |
| `number` ohne `step` | 11 | 11 (durchweg geringfügig) |
| textartig ohne `maxlength` | 72 | **63** |
| **Echter Bug, keine bloße Härtung** | — | **1** |

Die Zahl allein taugt so wenig als Kennzahl wie die Hex-Farben aus
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) — Such- und Filterfelder brauchen kein
`maxlength`. Entscheidend ist die Trennung unten.

---

## 1. Der eine echte Bug — wirkungslose PIN-Begrenzung

**`js/steuerberater.js:29`**

```html
<input type="number" class="form-input" id="stbPin" placeholder="z.B. 1234" maxlength="8">
```

**`maxlength` hat bei `type="number"` keine Wirkung.** Das ist keine fehlende Härtung, sondern
eine Begrenzung, die aussieht, als wäre sie da, und nichts tut. Die Steuerberater-PIN ist damit
unbegrenzt lang. Zusätzlich fehlen `min`, `max` und `step` — führende Nullen gehen bei
`type="number"` außerdem verloren, eine PIN `0042` wird zu `42`.

```html
<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" id="stbPin" …>
```

Aufwand: ~5 Min. **Das ist der einzige Punkt dieser Liste, der ohne Zutun des Nutzers falsch
funktioniert** — alles andere setzt eine Fehleingabe voraus.

---

## 2. Geldbeträge ohne Untergrenze — negative Werte landen in den Büchern

Das Muster ist überall identisch: `type="number" step="0.01"` ohne `min="0"`, und auf der
Speicherseite `parseFloat(…) || 0` ohne Klemmung. `|| 0` fängt `NaN` ab, **nicht** `-500`.

**`js/lager.js:623-625`** — belegt für den Verkaufsdialog:
```javascript
verkaufspreis:            parseFloat(document.getElementById('se_preis').value) || 0,
plattformgebuehrProzent:  parseFloat(document.getElementById('se_gebuehr').value) || 0,
```

| Ort | Feld | Folge einer negativen Eingabe |
|---|---|---|
| `js/lager.js:586` | `se_preis` — Verkaufspreis | negativer Erlös in Z11 der EÜR |
| `js/lager.js:587` | `se_versandK` — Versand Käufer | dito, fließt in dieselbe Zeile |
| `js/lager.js:590` | `se_gebuehr` — Plattformgebühr % | negative Gebühr **erhöht** den Gewinn |
| `js/lager.js:591` | `se_versandV` — Versand Verkäufer | negative Ausgabe in Z64 |
| `js/lager.js:2558` | `le_preis` | Einkaufspreis negativ → Z22 |
| `js/ksk.js:142` | `kskCalcEin` — Jahreseinkommen | negative Beitragsbemessung |
| `js/ksk.js:257` | `ksk_ein` — gemeldetes Einkommen | dito, und dieser Wert wird gespeichert |
| `js/svs.js:295` | `nb_betrag` | — |
| `rechnungen/js/mahnungen.js:108` | `mahnBasiszins` — §247 BGB | negativer Verzugszins |

**Zwei Sonderfälle, bewusst getrennt:**

- **`rechnungen/js/mahnungen.js:108`** braucht `min` **nicht** bei 0: der Basiszinssatz nach §247
  BGB war zwischen 2016 und 2022 **tatsächlich negativ** (bis −0,88 %). Richtig ist hier
  `min="-5" max="20"`, nicht `min="0"`. Ein blindes `min="0"` wäre ein neuer Fehler.
- **`js/schweiz.js:1136/1140/1144`** (`convEur`, `convChf`, `convRate`) — CH ist nach
  [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) aus Web entfernt, die Datei liegt dormant.
  **Nicht anfassen**, solange sie nicht wieder aktiviert wird.

**Empfohlenes Vorgehen:** `min="0"` an die Felder **und** auf der Speicherseite klemmen. Nur das
Attribut reicht nicht — `min` ist im Browser eine Validierungsangabe, kein Wertfilter, und
`parseFloat` liest den Rohwert unabhängig davon.

---

## 3. Mengen und Beträge ohne Obergrenze — 28 Felder

Weniger dringend als Abschnitt 2: ein absurd großer Wert fällt beim Ansehen auf, ein negativer
nicht. Relevant sind die Felder, deren Wert **gespeichert** wird und danach in Summen einfließt:

| Datei | Felder |
|---|---|
| `lager/page.js` | `buch_preis:252`, `buch_versandKaeufer:261`, `buch_versandVk:274`, `neu_preis:719`, `bulk_versand:1159`, `bulk_preis_:1351` |
| `js/lager.js` | dieselben fünf wie oben, plus `le_anzahl:2562` |
| `eigenbelege/js/app.js` | `eb-brutto:657`, `pv-preis:979`, zwei ohne `id` bei `:446/:447` |
| `js/materiallager.js` | `mle_menge:235`, `mlv_menge:333` |
| `js/fahrtenbuch.js` | `fb_km_ab:215`, `fb_km_an:220` |
| `js/svs.js` | `svs_vorschreibung:231`, `nb_betrag:295` |

`index.html:279` (`demoAmt`) ist der Demo-Rechner der Landingpage — **kein Fund**, nichts wird
gespeichert.

---

## 4. Textfelder ohne `maxlength` — 63 echte

Alles hier landet in `localStorage`. Ein Feld ohne Obergrenze ist keine Sicherheitslücke, aber
`localStorage` hat ein hartes Kontingent (5–10 MB je Origin), und **das Kontingent teilt sich die
gesamte App**. Ein einzelnes überlanges Feld kann das Speichern anderer Module zum Scheitern
bringen.

**Die vordringliche Gruppe** — Rechnungsempfängerdaten in `rechnungen/js/rechnung.js`:
`ncFirma:179`, `ncAnsprech:180`, `ncStrasse:183`, `ncPlz:184`, `ncOrt:185`, `ncEmail:188`,
`ncTelefon:189`. Diese Werte gehen in die **XRechnung-XML** und in das Druck-Layout. `ncPlz` ohne
`maxlength` ist der auffälligste — eine Postleitzahl hat fünf Stellen.

**Der Rest nach Aufkommen:** `lager/page.js` (22), `js/lager.js` (18),
`eigenbelege/js/app.js` (13), `js/svs.js` (2), `js/app.js:1782`, `js/stb-share.js:281`.

**Bewusst keine Funde** (nicht persistiert, `maxlength` wäre hier nur Rauschen):
`buchSearch`, `lagerSearch`, `lagerFilterArtikelnr`, `f-suche`, `lpFilterSearch`,
`invKundeSearch`, `syncCodeConfirm`, `syncResetConfirm` sowie `graphify-out/graph.html:52`.

---

## 5. `Number.isFinite` — der Befund ist besser als erwartet

660 Aufrufe von `parseFloat`/`parseInt` im App-Code, davon **469 mit `|| 0`-Fallback,
`isFinite`- oder `isNaN`-Prüfung**; `Number.isFinite` selbst wird 35 × verwendet.

Die verbleibenden ~190 sind **überwiegend Fehlalarm**: Vergleiche (`parseFloat(a) > parseFloat(b)`),
Sortierungen und Ausgaben, bei denen `NaN` sich unschädlich verhält. **Hier lohnt kein
Flächenlauf.** Der eigentliche Mangel ist nicht das fehlende `isFinite`, sondern das fehlende
**Klemmen nach unten** aus Abschnitt 2 — `|| 0` ist gegen `NaN` wirksam und gegen `-500` wirkungslos.

---

## Reihenfolge

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | `stbPin` auf `type="text"` umstellen | Einzige Begrenzung, die vorgibt zu wirken und nicht wirkt | 5 Min |
| 2 | `min` + Klemmung an die 9 Geldfelder | Negative Beträge verfälschen EÜR und Gewinn | ~45 Min |
| 3 | `maxlength` an die 7 Rechnungsempfängerfelder | Gehen in XRechnung-XML und Druck-Layout | ~15 Min |
| 4 | `maxlength` an den Rest der persistierten Textfelder | `localStorage`-Kontingent teilt sich die App | ~1 h |
| 5 | `max` an die gespeicherten Zahlenfelder | Kosmetik gegen Vertipper | ~1 h |

> **Vor dem Anfassen:** `js/lager.js`, `lager/page.js` und `js/app.js` wurden am 2026-08-15/16 von
> parallelen Sessions gehalten. `git status` prüfen, siehe [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md).
