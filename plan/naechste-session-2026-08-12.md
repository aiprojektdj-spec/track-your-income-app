# Nächste Session — Arbeitsplan (Stand 2026-08-12)

**Lies zuerst [`uebergabe-2026-08-12.md`](uebergabe-2026-08-12.md).** Dort stehen die Arbeitsregeln
(parallele Sessions, pfad-gescoped committen, Browser-Cache-Falle, Encoding, Whop-Gate-Verifikation),
der Local-1.7-Status und die offenen Performance-Posten. **Diese Datei wiederholt das nicht** — sie
schließt drei Lücken der Übergabe und sagt, in welcher Reihenfolge weitergearbeitet wird.

Alles hier ist am 2026-08-12 gegen Code und `git log` geprüft.

---

## 0. Erste zwei Befehle, bevor du irgendwas anfasst

```bash
git status --short && git log --oneline -8
```

An diesem Repo arbeiten regelmäßig mehrere Sessions **im selben Working Tree**. Was unten „offen"
heißt, kann seit dem Schreiben dieser Datei in Arbeit sein. Eine Datei, die in `git status` als
geändert auftaucht, hält jemand anders — nicht anfassen, sondern per `send_message` abstimmen.

```bash
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

Muss stumm durchlaufen. **28 Testdateien, 327 Einzeltests** (die Übergabe sagt noch „14+" — veraltet).

---

## 1. Was die Übergabe nicht enthält

Drei Blöcke fehlen dort vollständig. Das ist kein Vorwurf — sie entstand aus einer Spur, die diese
Themen nicht bearbeitet hat. Aber wer nur die Übergabe liest, hält die Arbeit für weiter fertig,
als sie ist.

### 1.1 Sieben von siebzehn Audits sind nie gelaufen 🟠

`plan/audit-2026-08-10-masterplan.md` plant 17 Audits. Gelaufen sind **10** (01–10), mit
49 + 2 Funden. Offen:

| Thema | Befehl | Prio laut Masterplan | Warum es zählt |
|---|---|---|---|
| Compliance (DDG/DSGVO/GoBD/AGB/E-Rechnung/UStG) | `/compliance-legal` | Mittel | Das einzige offene Audit mit **gesetzlichen Pflichten** als Gegenstand |
| Accessibility (WCAG 2.1) | `/accessibility` | Mittel | Letzter A11y-Lauf war 2026-07-24 und hieß selbst „Vollaudit-Rest" |
| Monetarisierung (Pricing, Funnel, Churn) | `/monetarisierung` | Mittel | Hängt inhaltlich am P-Block unten |
| DSGVO-Scan (Consent, Storage, Tracker) | `/datenschutz` | Niedrig | Mehrfach behandelt; Anwalt/Whop-DPA blockiert ohnehin |
| UI-Vergleich vs. Konkurrenz | `/vergleich-ui` | Niedrig | Nie gemacht |
| Technischer Stack-Vergleich | `/vergleich-technisch` | Niedrig | Nie gemacht |
| Buchhalterischer Vergleich | `/vergleich-buchhaltung` | Niedrig | Nie gemacht |

Der Skill **ist** die Audit-Definition — kein zusätzlicher Prompt nötig. Nach jedem Lauf:
Fund-Datei anlegen (`plan/funde-audit-NN-<thema>-<datum>.md`), Status im Masterplan auf ✅ setzen,
Zeile in `funde-gesamt-2026-08-10.md` ergänzen. **Ein Audit pro Session**, sonst wird die Fundliste
unlesbar.

### 1.2 P-Block — Produktstrategie, 6 Funde, unbearbeitet 🟠

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

### 1.3 M-Block — Landing-Copy, 6 Funde, unbearbeitet 🟠

Quelle: [`funde-audit-08-copy-marketing-2026-08-10.md`](funde-audit-08-copy-marketing-2026-08-10.md).

| # | Fund | Sev |
|---|---|---|
| M1 | E-Rechnung ist der stärkste Verkaufspunkt und steht in einem Bullet | 🔴 |
| M2 | Kein einziger Sozialbeweis | 🔴 |
| M3 | Die kostenlose Version existiert auf der Seite nicht | 🟠 |
| M4 | Preisanker zeigt in die richtige Richtung, aber nicht auf den Wettbewerb | 🟠 |
| M5 | Hero-Headline ist stark, adressiert aber niemanden | 🟡 |
| M6 | Acht CTAs, ein Ziel, drei verschenkte Chancen | 🟡 |

**M2 braucht echte Kundenstimmen** — nichts erfinden, auch nicht „anonymisiert". Ohne echte
Referenz bleibt der Fund offen; das ist die richtige Antwort, nicht ein Platzhalter-Testimonial.
**M3 kollidiert mit der Local-Einstellung:** „kostenlose Version" auf der Landing zu bewerben, die
nicht mehr gepflegt wird, wäre irreführend — vor dem Umsetzen mit dem User klären, ob die
Offline-Version überhaupt noch beworben werden soll.

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

1. **F2** — `xlsx.full.min.js` (929 KB) lazy laden. Größter freier Performance-Posten, Muster
   `_ensureApexCharts()` in `js/dashboard.js:11`. Details in der Übergabe, Abschnitt 1.1.
2. **`/compliance-legal`** — das einzige offene Audit über gesetzliche Pflichten.
3. **`/accessibility`** — zweites Audit mit Prio Mittel.
4. **P3 / P6** aus dem P-Block (echte Feature-/Content-Arbeit ohne Nutzerentscheidung).
5. **F6** — Cloud-Sync-Krypto in einen Web Worker. **Erst nach Freigabe des Users:** das ist der
   Live-Sync-Pfad eines zahlenden Kunden und ohne Whop-Login nicht E2E prüfbar. Kein Delta-Sync.

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
