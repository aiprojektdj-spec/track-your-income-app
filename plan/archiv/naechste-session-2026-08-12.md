# Nächste Session — Arbeitsplan (Stand 2026-08-12, 15:10)

> ⛔ **Historisch — hier stehen keine gültigen Aufgaben mehr.** Diese Datei ist der Arbeitsplan vom
> 2026-08-12 und in Teilen überholt (u. a. führt sie F2 und sieben von siebzehn Audits als offen;
> alle 17 Audits sind gelaufen, F2 ist gebaut). **Die einzige gültige Aufgabenliste ist
> [`01-AUFGABEN.md`](01-AUFGABEN.md)**, Einstieg über [`00-STAND.md`](00-STAND.md).
> Weiter nützlich ist hier nur noch **Abschnitt 4** (welcher Test welche Logik schützt).

**Lies zuerst [`uebergabe-2026-08-12.md`](uebergabe-2026-08-12.md).** Dort stehen die Arbeitsregeln
(parallele Sessions, pfad-gescoped committen, Browser-Cache-Falle, Encoding, Whop-Gate-Verifikation),
der Local-1.7-Status und die offenen Performance-Posten. **Diese Datei wiederholt das nicht** — sie
schließt die Lücken der Übergabe und sagt, in welcher Reihenfolge weitergearbeitet wird.

Alles hier ist am 2026-08-12 gegen Code und `git log` geprüft.

> **Korrektur gegenüber der ersten Fassung dieser Datei (heute Mittag):** Zwei Blöcke haben sich
> innerhalb weniger Stunden erledigt, weil parallele Sessions daran gearbeitet haben —
> **`/compliance-legal` ist gelaufen** (Funde L1–L6, siehe 1.1) und **F1/F2/F3/F7** aus dem
> Performance-Block sind gebaut. Wer diese Datei liest, ohne vorher `git log` und
> `plan/audit-2026-08-10-masterplan.md` zu prüfen, arbeitet Erledigtes nach. Das ist in diesem
> Repo schon mehrfach passiert.

---

## 0. Erste zwei Befehle, bevor du irgendwas anfasst

```bash
git status --short && git log --oneline -8
```

An diesem Repo arbeiten regelmäßig mehrere Sessions **im selben Working Tree**. Was unten „offen"
heißt, kann seit dem Schreiben dieser Datei in Arbeit sein. Eine Datei, die in `git status` als
geändert auftaucht, hält jemand anders — nicht anfassen, sondern per `send_message` abstimmen.

**Stand 2026-08-12, 15:10 — fremd gehalten:** `app.html`, `index.html`, `css/style.css`,
`eigenbelege/index.html`, `rechnungen/index.html`, `js/cookie-banner.js`, `js/companies.js`,
`js/topnav.js`, `js/whop-auth.js`, `plan/OFFEN.md` (Cookie-Banner-CSS-Auslagerung nach
`css/cookie-banner.css`). **Das kollidiert direkt mit L3 und L4** — siehe Abschnitt 1.2.

```bash
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

Muss stumm durchlaufen. **28 Testdateien, 327 Einzeltests** (die Übergabe sagt noch „14+" — veraltet).

---

## 1. Was die Übergabe nicht enthält

Diese Blöcke fehlen dort vollständig. Das ist kein Vorwurf — die Übergabe entstand aus einer Spur,
die diese Themen nicht bearbeitet hat. Aber wer nur sie liest, hält die Arbeit für weiter fertig,
als sie ist.

### 1.1 Sechs von siebzehn Audits sind nie gelaufen 🟠

`plan/audit-2026-08-10-masterplan.md` plant 17 Audits. Gelaufen sind **11** (01–11), zuletzt
Compliance am 2026-08-12. Offen:

| Thema | Befehl | Prio laut Masterplan | Warum es zählt |
|---|---|---|---|
| Accessibility (WCAG 2.1) | `/accessibility` | Mittel | Letzter A11y-Lauf war 2026-07-24 und hieß selbst „Vollaudit-Rest" — war also nie vollständig |
| Monetarisierung (Pricing, Funnel, Churn) | `/monetarisierung` | Mittel | Hängt inhaltlich am P-Block unten; ohne die Entscheidungen zu P2/P4/P5 bleibt es Theorie |
| DSGVO-Scan (Consent, Storage, Tracker) | `/datenschutz` | Niedrig | Mehrfach behandelt, zuletzt vom Compliance-Lauf mitabgedeckt; Anwalt/Whop-DPA blockiert ohnehin |
| UI-Vergleich vs. Konkurrenz | `/vergleich-ui` | Niedrig | Nie gemacht |
| Technischer Stack-Vergleich | `/vergleich-technisch` | Niedrig | Nie gemacht |
| Buchhalterischer Vergleich | `/vergleich-buchhaltung` | Niedrig | Nie gemacht |

Der Skill **ist** die Audit-Definition — kein zusätzlicher Prompt nötig. Nach jedem Lauf:
Fund-Datei anlegen (`plan/funde-audit-NN-<thema>-<datum>.md`), Status im Masterplan auf ✅ setzen,
Zeile in `funde-gesamt-2026-08-10.md` ergänzen. **Ein Audit pro Session**, sonst wird die Fundliste
unlesbar.

### 1.2 L-Block — Compliance/Legal, 6 Funde, frisch und unbearbeitet 🔴

Quelle: [`funde-audit-11-compliance-legal-2026-08-10.md`](funde-audit-11-compliance-legal-2026-08-10.md)
(Lauf vom 2026-08-12). Zusammenfassung auch in `plan/OFFEN.md` §2.10. **Das ist der einzige offene
Block mit einem 🔴-Fund vor Launch** — deshalb steht er in Abschnitt 3 an erster Stelle.

| # | Fund | Rechtsgrundlage | Sev |
|---|---|---|---|
| L1 | Zwei widersprüchliche AGB-Fassungen; die In-App-Modale (`js/app.js:927`, `rechnungen/js/app.js:227`) zeigen eine **vor-Whop**-Fassung ohne Widerruf, Preise, Whop | §305 II, §305c II, §307 I 2 BGB | 🔴 VOR LAUNCH |
| L3 | `agb.html` aus der App heraus nirgends verlinkt (nur Impressum + Datenschutz) | §312i I Nr. 4 BGB | 🟠 |
| L2 | `agb_accepted` speichert einen Zeitstempel ohne Version → AGB-Änderung erreicht **keinen** Bestandsnutzer | §308 Nr. 5 BGB | 🟠 |
| L4 | Banner sagt „Cookies", tatsächlich localStorage/IndexedDB (`js/cookie-banner.js:34`) | §25 TDDDG | 🟢 |
| L5 | Whop-DPA/AV-Vertrag offen — **zusätzlich Upstash und Vercel prüfen** | Art. 28 DSGVO | 🟠 (Dritte) |
| L6 | Anwalts-Freigabe AGB §11 + §356a; der AGB-Text weist selbst darauf hin | — | 🟠 (Dritte) |

**Achtung Kollision:** L3 fasst `app.html`, `lager/index.html`, `rechnungen/index.html`,
`eigenbelege/index.html` an, L4 fasst `js/cookie-banner.js` an — **alle diese Dateien hält gerade
eine andere Session** (Cookie-Banner-CSS-Auslagerung). Erst `git status` prüfen; wenn sie noch
gehalten werden, mit L1 und L2 anfangen (`js/app.js`, `rechnungen/js/app.js` sind frei) und L3/L4
nachziehen, sobald der Working Tree sauber ist.

Nicht neu aufrollen: L5 und L6 warten seit Wochen auf Dritte und stehen in `OFFEN.md` Abschnitt 3.

### 1.3 P-Block — Produktstrategie, 6 Funde, unbearbeitet 🟠

Quelle: [`funde-audit-07-product-manager-2026-08-10.md`](funde-audit-07-product-manager-2026-08-10.md).
Kein einziger Commit adressiert sie.

| # | Fund | Sev |
|---|---|---|
| P1 | Die kostenlose Local-Version ist **ungegated** (`Local 1.7/js/license.js:17`, `PUBLIC_KEY_JWK: null` → Entwicklermodus) | 🔴 |
| P2 | Drei Personas beworben, nur eine wird wirklich gewonnen | 🔴 |
| P3 | Freelancer fehlen Stundensatz / Zeiterfassung / Projekt-Zuordnung — null Treffer im Code | 🟠 |
| P4 | Ein einziger Preis (15 €) gegen 3-Stufen-Wettbewerb | 🟠 |
| P5 | GbR ist der stärkste unbesetzte Markt, wird aber nicht als Spitze geführt | 🟠 |
| P6 | Akademie startet für alle mit „Was ist Reselling überhaupt?" | 🟡 |

**P1 hat sich mit der Local-Einstellung erledigt** — eine nicht mehr gepflegte Offline-Version muss
kein Lizenz-Gate haben. Bitte im Fund so vermerken, statt es zu bauen.
**P2, P4, P5 sind Entscheidungen des Users** (Positionierung, Preisstufen) — nicht einseitig
umsetzen, sondern als Frage aufbereiten. **P3 und P6** sind normale Feature-/Content-Arbeit.

### 1.4 M-Block — Landing-Copy, 6 Funde, unbearbeitet 🟠

Quelle: [`funde-audit-08-copy-marketing-2026-08-10.md`](funde-audit-08-copy-marketing-2026-08-10.md).

| # | Fund | Sev |
|---|---|---|
| M1 | E-Rechnung ist der stärkste Verkaufspunkt und steht in einem Bullet | 🔴 |
| M2 | Kein einziger Sozialbeweis | 🔴 |
| M3 | Die kostenlose Version existiert auf der Seite nicht | 🟠 |
| M4 | Preisanker zeigt in die richtige Richtung, aber nicht auf den Wettbewerb | 🟠 |
| M5 | Hero-Headline ist stark, adressiert aber niemanden | 🟡 |
| M6 | Acht CTAs, ein Ziel, drei verschenkte Chancen | 🟡 |

**M1 ist durch den Compliance-Lauf bestätigt:** XRechnung-Ausgang, Eingangsprüfung und der
§14b-Hinweis sind gebaut und im UI präsent — das Feature ist da, nur das Marketing verschweigt es.
Der Fund ist damit reine Textarbeit ohne Entwicklungsaufwand.
**M2 braucht echte Kundenstimmen** — nichts erfinden, auch nicht „anonymisiert". Ohne echte
Referenz bleibt der Fund offen; das ist die richtige Antwort, nicht ein Platzhalter-Testimonial.
**M3 kollidiert mit der Local-Einstellung:** „kostenlose Version" auf der Landing zu bewerben, die
nicht mehr gepflegt wird, wäre irreführend — vor dem Umsetzen mit dem User klären.

Und **nie „GoBD-zertifiziert" schreiben** (kein IDW-PS-880-Testat), sondern „GoBD-konform
umgesetzt" mit Verweis auf die mitgelieferte Verfahrensdokumentation — die laut Compliance-Lauf
der Punkt ist, an dem Stackr den Wettbewerb schlägt.

---

## 2. Die eine offene Produktentscheidung aus R5

Steht in keiner anderen Datei, geht aber sonst verloren.

`js/cloud-sync.js` hält den Sync-Schlüssel seit `eafc902` in IndexedDB: einen
**nicht-extrahierbaren** `CryptoKey` für den täglichen Sync, **plus** die Rohbytes. Die Rohbytes
sind noch da, weil zwei Funktionen sie brauchen:

1. **„Code erneut anzeigen"** (`cs-show-code`) — der Wiederherstellungscode *ist* der Schlüssel,
   und dieser Dialog ist der einzige Weg, ein zweites Gerät anzubinden, wenn der Nutzer den Code
   nie notiert hat.
2. **StB-Envelope** (`js/stb-share.js`) — der Datenschlüssel wird für den Steuerberater verpackt.

Vollständige Nicht-Extrahierbarkeit (das, was der Audit-Fund vorschlug) heißt: **„Code erneut
anzeigen" fällt weg**, und die StB-Einladung müsste den Code abfragen. Sicherheitsgewinn gegen XSS
steht damit gegen ein Aussperr-Risiko bei Nutzern, die ihren Code verloren haben.

→ **Frage an den User, nicht selbst entscheiden.** Bis dahin ist der Zustand dokumentiert und der
Gewinn im Code ehrlich beschrieben („generische localStorage-Scraper greifen nicht mehr, ein
gezielter Angreifer kommt an IndexedDB").

---

## 3. Reihenfolge, wenn du keinen anderen Auftrag hast

1. **L1 + L3** — In-App-AGB-Modale auf eine Kurzfassung mit Link auf `agb.html` umstellen und
   `agb.html` in die vier App-Footer aufnehmen. Gehört zusammen, ist Textarbeit ohne Logikänderung,
   und L1 ist der einzige 🔴-Fund mit „vor Launch". Für L3 zuerst `git status` (s. 1.2).
2. **L2** — `agb_accepted` mit Versionsstand (`{"version":2,"ts":"…"}`), damit §9 der eigenen AGB
   überhaupt umsetzbar wird. Beide Module teilen sich den Flag — gemeinsam umstellen.
3. **L4** — ein Satz in `js/cookie-banner.js`, sobald die Datei frei ist.
4. **`/accessibility`** — das ranghöchste der sechs nie gelaufenen Audits; der letzte Lauf hieß
   selbst „Vollaudit-Rest".
5. **P3 / P6** aus dem P-Block (echte Feature-/Content-Arbeit ohne Nutzerentscheidung).
6. **M1** — E-Rechnung aus dem Bullet holen; das Feature existiert nachweislich.
7. **F4** — `preload` für `css/style.css` und `js/app.js`; die zwei Fonts sind schon drin
   (`app.html:23-24`). Zwei Zeilen. **`app.html` wird gerade fremd gehalten.**
8. **F5** — Tabellen-Neurendern per `innerHTML`. **Erst messen**, dann entscheiden: bei kleinen
   Datenmengen ist es kein Problem, und ein Umbau auf inkrementelles Rendern ist teuer.
9. **F6** — Cloud-Sync-Krypto in einen Web Worker. **Erst nach Freigabe des Users:** das ist der
   Live-Sync-Pfad eines zahlenden Kunden und ohne Whop-Login nicht E2E prüfbar. Kein Delta-Sync
   bauen — CAS und Merge sind korrekt und getestet.

Erledigt und **nicht** nochmal anfangen: F1 (`defer` an den Sub-Apps), F2 (`Utils.ensureXlsx()`),
F3 (`_ensureChartJs()`), F7 (`clearInterval` in `_startPeriodicBackup()`) — alle in `94034de`
und `27f7cd6`.

---

## 4. Welcher Test schützt welche Logik

Wichtig für **UI-/Politur-Sweeps**: mehrere dieser Module sehen nach reiner Optik aus, tragen aber
Steuer- und GoBD-Logik. Wenn du eine dieser Dateien anfasst, lauf den zugehörigen Test — er ist
cache-immun und läuft in unter einer Sekunde.

| Datei | Test | Was festgenagelt ist |
|---|---|---|
| `js/steuertermine.js` | `test-steuertermine.js` | UStVA-Rhythmus, Dauerfrist §46/§47 UStDV, §108 Abs. 3 AO (Osterformel). **Termin-IDs nicht umbenennen** — daran hängt das Abhaken |
| `js/ausgaben.js` | `test-ksa-jahresabhaengig.js` | KSA-Satz und Freigrenze je Jahr. §24 **Abs. 2 Satz 2** KSVG zitieren, Abs. 3 ist weggefallen |
| `js/store.js` (Audit-Log) | `test-audit-clock-back.js` | Uhr-Rücksprung-Vermerk liegt **innerhalb** der Prüfsumme |
| `js/store.js` (Z3-Export) | `test-z3-export.js` | Datenträgerüberlassung §147 Abs. 6 AO |
| `lager/page.js` | `test-lager-audit-log.js` | **Jede** `Store.setAsync()`-Stelle muss protokollieren — der Test findet auch neue |
| `rechnungen/js/rechnung.js` | `test-leitweg-ksa-verwerter.js` | Leitweg-ID-Kette bis `<ram:BuyerReference>` |
| `rechnungen/js/dokumente.js` | `test-teilzahlung-gemischte-saetze.js` | `Store.salePerRate()` — sonst wird ein 7 %-Anteil mit 19 % genettet |
| `api/sync.js` | `test-api-sync.js`, `test-owner-identity.js` | Scope-/Grant-Deckel, Owner-Identität über `me.sub` |
| `api/blob-upload.js` | `test-blob-budget.js` | Byte-Budget, `EXPIRE … NX` |
| `js/cloud-sync.js` | `test-sync-key-storage.js`, `test-aad-fallback-ablauf.js`, `test-cloud-sync.js` | Schlüssel-Migration ohne Verlustpfad, AAD-Ablauf |
| `js/backup-crypto.js` | `test-backup-crypto-restore.js` | Import-Allowlist, `kdf.iterations` aus der Datei |
| `js/stb-share.js` | `test-stb-share.js` | Envelope v1/v2, Fingerabdruck |

Für den L-Block gibt es **keinen** Test — L1/L2 fassen `js/app.js` und `rechnungen/js/app.js` an,
beide ohne Harness. Verifikation dort per Browser-Pane (Modul-Renderer direkt aufrufen, s. Fallen
in der Übergabe), nicht per Testsuite.

---

## 5. Zwei Termine, die sonst niemand bemerkt

- **2026-12-01** — der AAD-Migrations-Fallback in `js/cloud-sync.js` läuft ab (`AAD_FALLBACK_UNTIL`).
  Danach den `catch`-Zweig in `_decryptCt` und die Konstante **ersatzlos entfernen**. Der Auftrag
  steht im Code, `test-aad-fallback-ablauf.js` prüft, dass die Datumssperre wirkt.
- **Jahreswechsel 2027/2028** — in `Ausgaben._getKsaWerte()` den dann veröffentlichten
  KSA-Abgabesatz ergänzen. Ohne Eintrag rechnet Stackr mit dem letzten bekannten Wert (5,0 %)
  weiter; das ist bewusst so, weil ein zu hoher Schätzwert besser ist als eine stille Unterzahlung.
- Quartalsweise: `js/vendor/VERSIONS.md` — Advisory-Seiten von SheetJS und Chart.js prüfen. Beide
  Bibliotheken sind von keinem `npm audit` erfasst, es kommt also **keine** Warnung von allein.
  **Nie `npm install xlsx`** — das Paket steht bei 0.18.5 und holt die CVEs zurück.
