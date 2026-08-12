# Audit 13 — Monetarisierung (Pricing, Funnel, Churn)

**Gelaufen:** 2026-08-12 · **Skill:** `/monetarisierung` · **Masterplan-Prio:** Mittel
**Fund-Präfix:** `Z` (Zahlung) — `R`/`T`/`P`/`M`/`L`/`F`/`A` sind belegt.

Kennzeichnung: **[geprüft]** = an Code verifiziert · **[Markt]** = externe Preisangabe aus der
Skill-Definition, nicht neu recherchiert.

> **Masterplan und `funde-gesamt-2026-08-10.md` habe ich NICHT aktualisiert.** Beide Dateien
> hält die laufende Session „Audit 2026-08-10 Masterplan". Status-Zeile bitte dort nachtragen:
> `| 13 | Monetarisierung | /monetarisierung | ✅ 2026-08-12 | 11 Funde (1 🔴, 5 🟠, 4 🟡, 2 ✅) |`

---

## Vorbemerkung: die Prämisse des Audits ist weggefallen

Die Skill-Definition baut auf der **kostenlosen Offline-Version (Local 1.7) als wichtigstem
Top-of-Funnel** auf — zwei der sieben Analysebereiche (1 und 6) und ein Akzeptanzkriterium
(„Offline→Web-Funnel als zentraler Hebel adressiert") hängen daran.

Dieser Funnel existiert seit dem **2026-08-11** nicht mehr: Local 1.7 ist auf Nutzerentscheidung
eingestellt (Memory `local17-eingestellt-2026-08-11`, Abschluss-Commit `244520c`). Der Audit ist
deshalb mit korrigierter Prämisse gelaufen — **Landing + Live-Demo sind der gesamte Top-of-Funnel.**

---

## Fundliste

### Z1 — Der Funnel hat nur noch einen Eingang 🔴 [geprüft]

100 % des Neugeschäfts läuft jetzt über `index.html`. Vorher stand dahinter eine installierte Basis
kostenloser Offline-Nutzer, die man verlustfrei hochziehen konnte; die ist weg (nicht abgewandert —
sie wird nur nicht mehr bedient).

Das ist keine Landingpage-Kritik, sondern eine Risikoverschiebung: **jede Conversion-Schwäche auf
der Landing kostet jetzt doppelt**, weil kein zweiter Einstieg mehr kompensiert. Gleichzeitig fällt
die Rechtfertigung für den Hard-Gate schwerer — es gibt keine kostenlose Alternative mehr, auf die
man Preissensible verweisen kann.

Konsequenz für künftige Läufe: Bereich 1 und 6 der Skill-Definition sowie das Akzeptanzkriterium
sind **gegenstandslos** und sollten aus `~/.claude/skills/monetarisierung/SKILL.md` entfernt werden,
sonst meldet jeder Lauf denselben toten Hebel erneut. Ebenfalls veraltet dort: „Offen: echte
Whop-Plan-Links + Referral-Rechtstext" (beides erledigt, s. Z6).

### Z2 — M3 ist erledigt, nicht offen ✅ [geprüft]

Der Copy-Audit führt M3 „Die kostenlose Version existiert auf der Seite nicht" als offenen Fund.
**Das ist jetzt der richtige Zustand, nicht ein Mangel.** Die Landing erwähnt keine Gratis-Version,
und die FAQ (`index.html:643`) sagt „kein Download, keine Installation" — konsistent mit der
Einstellung. M3 bitte als *obsolet* schließen, nicht bauen. Eine nicht mehr gepflegte Version zu
bewerben wäre irreführend.

### Z3 — Landing und In-App-Gate widersprechen sich beim Jahresabo 🟠 [geprüft]

Der beste Monetarisierungs-Text des Projekts steht im **In-App-Gate**, nicht auf der Landing.

| | Landing (`index.html:556-582`) | In-App-Gate (`js/whop-auth.js:598-621`) |
|---|---|---|
| Default | **Monatlich** (`billing-btn-active`, `aria-pressed="true"`) | **Jahresabo** hervorgehoben, Monat sekundär |
| Ersparnis | nur Badge „25% günstiger" | **„SPAR 45 €"** absolut |
| Monatsäquivalent | erst nach Toggle-Klick | „entspricht 11,25 €/Monat" direkt |
| Gratis-Monate | — | **„3 Monate gratis"** |

Die absolute Zahl (`45 €`) und „3 Monate gratis" werden im Gate sauber aus `PRICE_MONTHLY`/
`PRICE_YEARLY` berechnet (`whop-auth.js:579-581`) — auf der Landing tauchen sie nie auf. Wer zuerst
die Landing sieht, bekommt die schwächere Variante.

**Maßnahme:** Landing-Framing an das Gate angleichen (Jahr vorausgewählt, 45 € absolut nennen).

### Z4 — 15 € liegt über jedem Einstiegstarif des Wettbewerbs 🟡 [Markt]

| Produkt | Einstieg | Mittel |
|---|---|---|
| lexoffice | — | 7,90 € / 15,90 € |
| FastBill | 0 € | 9 € / 19 € |
| Papierkram | 0 € | 9,90 € |
| sevDesk | 0 € | 12 € / 24 € |
| **Stackr** | **15 €** (einziger Tarif) | — |

Stackr ist damit teurer als jeder Einstieg und liegt auf Höhe der *mittleren* Stufen — bei
gleichzeitig **fehlendem Free-Tier**, das vier von vier Wettbewerbern haben.

**Wichtig: der Preisanker auf der Landing ist trotzdem richtig gesetzt.** `index.html:584-588`
vergleicht mit einer Steuerberater-Stunde (150–250 €), nicht mit dem Wettbewerb. Der Copy-Audit
schlägt unter **M4** vor, den Anker auf den Wettbewerb zu richten — **davon rate ich ab**: das lädt
zu genau dem Vergleich ein, den Stackr auf den Preis allein verliert. Der tragfähige Hebel ist
Leistungsumfang (12 Module inkl. Lager, GbR, KSK, Fahrtenbuch — in den 9-€-Tarifen nicht enthalten),
nicht Preisnähe.

### Z5 — Ein einziger Tarif ist jetzt der einzige Einstieg 🟠 → **Entscheidung des Users**

Solange die Gratis-Offline-Version existierte, war „ein Preis, keine Tarif-Treppe"
(`index.html:553`) eine Stärke: Preissensible hatten einen Platz. Jetzt haben sie keinen — sie
bouncen. Das ist die direkte Kopplung von Z1 an den P-Block-Fund **P4**.

Zwei Wege, beide legitim, **keiner davon einseitig umsetzbar:**

- **A — Einzelpreis halten**, 7-Tage-Trial als Abfederung, Positionierung klar Premium. Weniger
  Komplexität, weniger Support, höherer ARPU, mehr Bounce.
- **B — schlanker Zweittarif** (z. B. nur Rechnungen + EÜR, ~8–9 €) als Auffangbecken gegen die
  Free-Tiers. Mehr Conversion, aber Gate-Logik, Feature-Flags und Rechtstexte wachsen mit.

### Z6 — Checkout und Referral sind fertig, die Skill-Notiz ist veraltet ✅ [geprüft]

- Echte Whop-Plan-Links **sind verdrahtet**: `plan_iR6YIKLcychSZ` (monatlich),
  `plan_b5IBQ1lecggOT` (jährlich) — in `js/whop-auth.js:26-27`, `index.html:580` und
  `landing-v2.html:306/319` identisch.
- **Zwei Klicks** von Landing bis Whop-Checkout (`#preise` → CTA). Ziel „max. 3" erfüllt.
- Referral-Overlay vorhanden (`whop-auth.js:744`), Affiliate-Muster `?a={ref}` belegt.
- **Referral-Rechtstext existiert:** `agb.html:286` §11 Empfehlungsprogramm, aus dem Overlay
  verlinkt. Offen ist nur die **Anwalts-Freigabe** von §11 — nicht der Text.
- Kündigungsweg korrekt auf `whop.com/@me/settings/orders/` (`whop-auth.js:33`), nicht auf den
  Company-Hub.

### Z7 — Kontextwechsel beim Checkout, ausreichend abgefedert 🟡 [geprüft]

Checkout öffnet in neuem Tab (`target="_blank"`). Das Gate erklärt das vorab: „nach der Zahlung
wirst du beim Zurückwechseln zu diesem Tab automatisch erkannt" (`whop-auth.js:596`). Kein
Handlungsbedarf.

### Z8 — Kein Kündigungs-Vorlauf, keine Absichts-Erkennung 🟠 [geprüft]

Die Kündigung passiert vollständig bei Whop. Stackr erfährt davon **erst, wenn der Zugang schon weg
ist** — dann erscheint der Winback-Screen (`whop-auth.js:574`). Es gibt:

- keine Erinnerung vor der Verlängerung,
- keinen Hinweis vor dem Ablauf,
- keine Gelegenheit, vor der Kündigung ein Angebot zu machen (z. B. Wechsel Monat → Jahr).

Der Winback-Screen selbst ist gut gebaut — er kommt nur strukturell zu spät. Ein Vorlauf-Kontakt
wäre über den bestehenden client-seitigen Make.com-Pfad denkbar; das Verlängerungsdatum kennt
allerdings nur Whop, ohne dessen Daten bleibt es bei Whops eigenen Mails.

### Z9 — Downgrade ist datensicher ✅ [geprüft]

Sauber gelöst und ein echtes Verkaufsargument:

- Daten bleiben lokal, nichts wird beim Ablauf gelöscht (`whop-auth.js:596`).
- **4 h Offline-Grace** über ECDSA-P-256-signiertes Token (`whop-auth.js:53-58`) — kein
  Fehl-Aussperren bei Netzproblemen, und nicht fälschbar.
- Steuerberater-Nur-Lese-Code direkt auf dem Gate angeboten (`whop-auth.js:628-631`).

### Z10 — Eine einzige Einnahmequelle 🟡 → **Entscheidung des Users**

15 €/135 € ist der komplette Umsatz. Die **billigste realistische zweite Linie ist die
Steuerberater-Lizenz**, weil die Infrastruktur weitgehend steht: StB-Envelope (`js/stb-share.js`),
Nur-Lese-Zugriff und Freigabe-Code existieren. Fehlt: Mehr-Mandanten-Verwaltung und ein Preis.
Das ist ein neues Produkt, keine Optimierung — deshalb Entscheidung, nicht Maßnahme.

### Z11 — Das Gate steht vor dem Onboarding, die Aktivierung dahinter 🟠 [geprüft]

Reihenfolge im Code: `AuthUI.boot()` → Gate → erst danach `showOnboarding()`
(`js/app.js:166` und `:176`, Wizard ab `:1190`). Für einen Trial-Nutzer heißt das:

1. Karte hinterlegen, **dann**
2. 5-Schritt-Stammdaten-Wizard, **dann**
3. leere App.

Die Landing beweist das Produkt vorab mit einer echten interaktiven Mini-Demo
(`index.html:189-240`: Dashboard, Buchungen, EÜR, GoBD-Protokoll, „kein Video und keine
Animation") — **die App selbst startet dann leer**. Die 7 Trial-Tage sind das ganze
Aktivierungsfenster, und es gibt darin keine geführte erste Buchung und keine Demo-Daten auf Knopfdruck.

Das ist der stärkste unbesetzte Hebel: Der Trial verlangt Vorleistung (Karte), bevor der erste
Erfolg garantiert ist.

---

## Gesundheitsscore

| Bereich | Score | Kommentar |
|---|---|---|
| Landing→Abo-Funnel *(ersetzt „Offline→Web", s. Z1)* | **7**/10 | Live-Demo ist stark und ehrlich; aber nur ein Eingang, kein Auffangbecken |
| Pricing vs. Markt | **6**/10 | Über jedem Einstiegstarif, ohne Free-Tier; Anker richtig gesetzt, Umfang zu schwach begründet |
| Upgrade-Flow | **9**/10 | Gate/Winback ist das beste Stück Monetarisierung im Projekt; Landing hinkt hinterher (Z3) |
| Churn-Protection | **5**/10 | Datensicher (Z9), aber ohne jeden Vorlauf vor Ablauf/Kündigung (Z8) |
| Revenue-Diversifikation | **3**/10 | Eine Linie; StB-Lizenz liegt technisch fast fertig da |

## Top 3 Sofort-Maßnahmen

```
💰 QUICK WIN 1 — Jahresabo-Framing der Landing an das In-App-Gate angleichen
   Aufwand: ~1 h
   Impact: Verschiebung des Mix zu Jahresabo → höherer LTV, weniger Churn
   Implementierung: index.html:556-582 — billingYearly als Default (billing-btn-active +
   aria-pressed umdrehen, proPrice/proPricePeriod entsprechend initialisieren), Badge um die
   absolute Zahl ergaenzen ("Spar 45 € = 3 Monate gratis"), Werte wie in whop-auth.js:579-581
   aus 15/135 rechnen statt hart schreiben.
   ⚠ index.html ist derzeit von einer parallelen Session gehalten — vorher abstimmen.

💰 QUICK WIN 2 — Demo-Daten auf Knopfdruck im Leerzustand
   Aufwand: ~1 Tag
   Impact: Aktivierung innerhalb der 7 Trial-Tage; adressiert Z11 direkt
   Implementierung: Leerzustand nach dem Onboarding um "Mit Beispieldaten ansehen" erweitern;
   der Datensatz der Landing-Demo (index.html) existiert bereits und kann als Vorlage dienen.
   Pflicht: klar als Demo markieren und in einem Zug loeschbar halten (GoBD — Demo-Buchungen
   duerfen nicht ins Protokoll der echten Firma geraten).

💰 QUICK WIN 3 — Rückweg für die verwaisten Local-Nutzer benennen
   Aufwand: ~1 h
   Impact: die einzige verbliebene Bestandsbasis; ohne Hinweis geht sie still verloren
   Implementierung: FAQ-Eintrag auf index.html — Local-Daten lassen sich per verschluesseltem
   Export in die Web-Version importieren (Pfad existiert, Memory local-web-datentransfer-...).
   In Local 1.7 selbst ist kein CTA moeglich: eingestellt, wird nicht mehr angefasst.
```

## Strategisch (3–6 Monate)

1. **Tarifstruktur entscheiden (Z5)** — Einzelpreis halten oder Zweittarif gegen die Free-Tiers.
   Blockiert Z1-Folgearbeit; alles andere an der Landing ist Feinschliff daneben.
2. **Steuerberater-Lizenz (Z10)** — zweite Einnahmequelle mit der geringsten Baulast, weil
   Envelope und Nur-Lese-Zugriff stehen.
3. **Wert über Umfang begründen, nicht über Preisnähe (Z4)** — die 12 Module gegen die
   Feature-Grenzen der 9-€-Tarife stellen, statt in einen Preisvergleich zu gehen.
4. **Vorlauf vor dem Ablauf (Z8)** — Angebot „Monat → Jahr" bevor gekündigt wird, statt Winback
   danach.

## Was dieser Audit nicht konnte

- **Keine echten Funnel-Zahlen.** Es gibt kein Analytics (bewusst, DSGVO). Alle Conversion-Aussagen
  sind strukturell begründet, nicht gemessen. Die Prozentangaben im Skill-Output-Format
  („+X % Conversion") habe ich deshalb weggelassen statt sie zu erfinden.
- **Whop-seitige Zahlen** (Trial-Abbruchquote, Churn, Affiliate-Umsatz) liegen nicht im Repo.
- **Kein Anwaltsersatz.** §11 AGB ist geschrieben, die Freigabe fehlt weiter.
