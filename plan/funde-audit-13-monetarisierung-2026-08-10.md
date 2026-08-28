# Monetarisierungs-Audit — Funde (2026-08-13)

**Session-Prompt:** `plan/session-prompt-audit-13-monetarisierung-2026-08-10.md`
**Scope:** Pricing, Trial-Funnel, Checkout, Churn, Revenue-Diversifikation.
**Abgrenzung:** Positionierung und Zielgruppen stehen in
[#14 Product-Manager](funde-audit-07-product-manager-2026-08-10.md), Landing-Copy in
[#15 Copy/Marketing](funde-audit-08-copy-marketing-2026-08-10.md) — hier nicht wiederholt.

---

## Wichtige Vorbemerkung: die Skill-Prämisse ist überholt

Der Skill baut seine gesamte Funnel-Analyse auf der Annahme auf, die **kostenlose
Offline-Version (Local 1.7) sei der wichtigste Top-of-Funnel**. Das gilt seit dem **2026-08-11
nicht mehr**: Local wird nicht mehr gepflegt (Nutzer-Entscheidung), der Ordner bleibt liegen,
gespiegelt wird nicht mehr. Erhalten bleibt nur der **Local-Import in Web** als Migrationspfad
für Bestandsdaten.

Damit fallen die Skill-Abschnitte 1 und 6 (Offline→Web-Funnel, Kannibalismus) in ihrer
ursprünglichen Form weg. Die eigentliche Frage lautet jetzt anders und ist wichtiger:
**Stackr hat aktuell überhaupt keinen Top-of-Funnel mehr außer der Landingpage.** Das ist unten
als **N1** geführt.

*Nebenbefund, der die Entscheidung stützt:* Wie in
[#14 P1](funde-audit-07-product-manager-2026-08-10.md) belegt, war Local ohnehin **ungegated**
(`PUBLIC_KEY_JWK: null` ⇒ Entwicklermodus). Es war also nie ein Funnel, sondern ein kostenloser
Vollzugang. Die Einstellung beseitigt ein Leck — sie hinterlässt aber eine Lücke.

---

## Funde

| # | Fund | Wirkung | Aufwand |
|---|---|---|---|
| N1 | Kein Top-of-Funnel mehr seit der Local-Einstellung | strategisch | Entscheidung |
| N2 | Der Trial ist in der App unsichtbar — Server kennt `trialing`, wirft es weg | 🔴 Churn + Rückbuchungen | ~1 Tag |
| N3 | Jahresabo ist nicht Default, obwohl es 25 % günstiger ist | 🟠 Conversion + Cashflow | ~1 h |
| N4 | Kein Signal vor Ablauf/Verlängerung, kein Winback nach außen | 🟠 Churn | mittel |
| N5 | Keine Preisstaffel für Mehr-Firmen-Nutzer und Steuerberater | 🟡 Umsatzpotenzial | mittel |

---

## 🔴 N2 — Der Trial ist in der App unsichtbar, obwohl der Server ihn kennt

**Das ist der teuerste Fund dieses Audits, und er ist fast geschenkt zu beheben.**

Der Trial läuft Whop-seitig: 7 Tage, **Karte hinterlegt**, Abbuchung am Tag 8. Der Server weiß
das auch — `api/whop-access.js:100` prüft ausdrücklich auf `status === 'trialing'`:

```javascript
obj.status === 'active' || obj.status === 'trialing' || …
```

Aber die Antwort an den Client wirft die Information weg
([api/whop-access.js:216](../api/whop-access.js#L216)):

```javascript
return res.status(200).json({ has_access: hasAccess, user_id: userId, grace_token: … });
```

Client-seitig sind die passenden Funktionen als **Stummel** vorhanden
([js/user-plan.js:29-32](../js/user-plan.js#L29)):

```javascript
function isPro()          { return true; }
function isTrialActive()  { return false; }
function getTrialDaysLeft() { return null; }
```

**Folge:** Während der sieben Trial-Tage kann die App dem Nutzer **nicht sagen**, dass er im
Trial ist, wie viele Tage bleiben oder wann die erste Abbuchung kommt. Das Kontomenü zeigt ihm
stattdessen „◆ Stackr Pro aktiv" ([js/whop-auth.js:681](../js/whop-auth.js#L681)) — formal
richtig, aber es verdeckt die anstehende Zahlung.

**Warum das teuer ist:**

1. **Rückbuchungen und Erstattungen.** Der klassische Ablauf: Nutzer testet, vergisst es, wird
   am Tag 8 mit 15 € belastet, fühlt sich überrumpelt → Erstattungsanfrage oder Chargeback.
   Chargebacks kosten Gebühren **und** beschädigen den Standing des Whop-Kontos. Genau das
   verhindert ein Hinweis am Tag 5.
2. **Der beste Conversion-Moment bleibt ungenutzt.** Tag 5–6 ist der Zeitpunkt, an dem ein
   Nutzer bereits Daten erfasst hat und der Wert sichtbar ist. Ein Hinweis wie
   *„Du hast in 6 Tagen 23 Buchungen erfasst und deine erste EÜR vorbereitet — ab morgen läuft
   dein Abo für 15 €/Monat"* macht aus einer Überraschung eine Bestätigung.
3. **Es widerspricht dem eigenen Ton.** Die Landingpage kommuniziert den Trial vorbildlich
   transparent („Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung") — an *jeder* Stelle.
   Dass ausgerechnet die App danach schweigt, ist ein Bruch mit der eigenen Linie.

**Fix — die Verkabelung fehlt, nicht die Logik:**

```javascript
// api/whop-access.js — Status durchreichen statt verwerfen
return res.status(200).json({
    has_access: hasAccess, user_id: userId, grace_token: …,
    status: membershipStatus,          // 'active' | 'trialing'
    renews_at: membershipRenewsAt      // falls Whop es liefert
});

// js/user-plan.js — die beiden Stummel füllen
function isTrialActive()    { return _status === 'trialing'; }
function getTrialDaysLeft() { return _renewsAt ? Math.ceil((_renewsAt - Date.now()) / 864e5) : null; }
```

Dazu ein dezenter Streifen im Kontomenü und ab Tag 5 ein Hinweis im Dashboard. **Der teuerste
Teil ist die UI, nicht die Technik** — die Statusabfrage läuft bei jedem `boot()` ohnehin.

*Dies ist derselbe Musterfall wie an anderer Stelle mehrfach beobachtet: die schwierige Hälfte
ist gebaut, die einfache fehlt.*

---

## 🟠 N3 — Das Jahresabo ist nicht die Standardauswahl

Der Preisumschalter auf der Landingpage steht auf **„Monatlich"**
([index.html:556](../index.html#L556), `billing-btn-active` auf dem Monats-Button), obwohl das
Jahresabo für beide Seiten besser ist:

| | Monatlich | Jährlich |
|---|---|---|
| Preis | 15 €/Monat | 135 €/Jahr = 11,25 €/Monat |
| Ersparnis für den Kunden | — | **45 €** (25 %) |
| Cashflow für den Anbieter | 15 € | **135 € sofort** |
| Churn-Risiko | jeden Monat | einmal im Jahr |

Im **Gate** ist es bereits richtig gelöst: `_showNoMembershipScreen` hebt das Jahresabo optisch
hervor, mit „SPAR 45 €"-Badge und der Umrechnung „entspricht 11,25 €/Monat · 3 Monate gratis"
([js/whop-auth.js:587-593](../js/whop-auth.js#L587)). Nur die Landingpage — die weit mehr
Besucher sieht — startet auf der schlechteren Variante.

**Fix:** Umschalter-Default auf „Jährlich" setzen und die Monatsvariante als Alternative
daneben. Eine Zeile plus ein umgestellter `billing-btn-active`.
**Erwarteter Effekt:** Bei SaaS-Preisschaltern liegt der Anteil der Default-Auswahl erfahrungsgemäß
deutlich über dem der Alternative — der Wechsel verschiebt Umsatz nach vorn, ohne den Preis
anzufassen. Zu messen, nicht zu glauben: Whop zeigt die Plan-Verteilung.

---

## 🟠 N4 — Kein Signal vor Ablauf, kein Weg zurück nach außen

**Vor dem Ablauf:** Es gibt keine Erinnerung an die anstehende Verlängerung. Für Jahresabos ist
das relevant — 135 € einmal im Jahr ohne Vorwarnung ist genau die Buchung, die zu einer
Rückfrage führt. (Ob Whop selbst eine Mail schickt, ist aus dem Code nicht feststellbar und
sollte im Whop-Backend geprüft werden.)

**Nach dem Ablauf** ist es dagegen gut gelöst: `_showNoMembershipScreen` dient laut Kommentar
ausdrücklich als **Winback-Screen für Neukauf *und* abgelaufenes Abo**
([js/whop-auth.js:574](../js/whop-auth.js#L574)) — mit beiden Preiskarten, gerechneter Ersparnis
und dem entscheidenden Satz: *„Deine Daten bleiben lokal gespeichert — nach der Zahlung wirst du
beim Zurückwechseln zu diesem Tab automatisch erkannt."*

Das ist der wichtigste Churn-Schutz, den eine Local-First-App hat: **Kündigen bedeutet keinen
Datenverlust.** Ein Nutzer, der weiß, dass seine Buchhaltung nicht weg ist, kommt eher zurück.
Es steht auch korrekt in AGB §7.

**Die Lücke:** Dieser Winback-Screen erreicht nur, wer die App **erneut öffnet**. Wer nach der
Kündigung nicht wiederkommt, sieht ihn nie. Es gibt keinen Kanal nach außen — kein E-Mail-Anlass,
keine Erinnerung.

**Realistischer Fix ohne Tracking und ohne DSGVO-Ärger:** Whop kennt die Mitgliedschaftsereignisse
(Kündigung, Ablauf, fehlgeschlagene Zahlung) und kann Mails versenden. Das ist eine
**Konfigurationsaufgabe im Whop-Backend**, kein Code. Zwei Mails reichen: eine drei Tage vor der
Jahresverlängerung, eine sieben Tage nach der Kündigung mit dem Hinweis, dass die Daten erhalten
sind.

**Zum Churn-Tracking allgemein:** Der Skill fragt nach Churn-Signalen im Produkt. Es gibt keine —
und das ist **richtig so**. Ein Local-First-Produkt mit E2E-Verschlüsselung, das mit „Deine Daten
verlassen dein Gerät nicht" wirbt, kann kein Nutzungsverhalten messen, ohne genau dieses
Versprechen zu brechen. Die Kennzahlen, die es braucht, liefert Whop ohnehin: aktive
Mitgliedschaften, Kündigungsquote, Trial-Konversion, Plan-Verteilung. **Kein Produkt-Tracking
nachrüsten.**

---

## 🟡 N1 — Seit der Local-Einstellung fehlt der Top-of-Funnel

Bis zum 2026-08-11 lief die Erzählung: kostenlose Offline-Version als Einstieg, Web-Abo als
Upgrade. Diese Stufe ist weg. Übrig bleibt: **Landingpage → Whop-Checkout mit Karte → App.**

Das ist ein Hard-Gate ohne Vorstufe. Die Wettbewerber haben durchweg eine:

| Anbieter | Einstieg |
|---|---|
| sevDesk | Testzeitraum |
| Lexware Office | Testphase |
| FastBill, Papierkram | kleiner Free-Tier |
| **Stackr** | 7-Tage-Trial **mit Kartenpflicht** |

Die Kartenpflicht ist die höchste Hürde in diesem Vergleichsfeld.

**Was den Verlust teilweise auffängt und heute schon existiert:** die **Live-Demo auf der
Landingpage** („Probier es aus. Hier. Jetzt."). Das ist die richtige Antwort auf ein Hard-Gate —
Wert zeigen, bevor die Karte verlangt wird. Sie ist derzeit ein Abschnitt unter vielen.

**Drei Optionen, absteigend nach Aufwand:**

1. **Demo aufwerten statt Free-Tier bauen.** Die Demo prominenter setzen (Hero-Bereich statt
   Mitte) und um die zwei Alleinstellungen erweitern, die kein Wettbewerber zeigen kann:
   Lager-Verwaltung und GbR-Gewinnverteilung. Kein neues Produkt, keine neue Codebasis.
   **Meine Empfehlung.**
2. **Trial ohne Kartenpflicht.** Senkt die Einstiegshürde deutlich, erhöht aber den Anteil
   unqualifizierter Anmeldungen und ist bei Whop eine Plan-Konfiguration. Messbar über die
   Trial-Konversionsrate.
3. **Read-only-Web-Tier.** Ein dauerhaft kostenloser Zugang, der Erfassen erlaubt, aber Export,
   Cloud-Sync und E-Rechnung sperrt. Größter Aufwand, und er widerspricht der klaren
   Ein-Preis-Erzählung („Ein Preis. Alles drin.").

**Nicht empfehlenswert:** Local wiederbeleben. Die Entscheidung ist gefallen, und die Version
war ohnehin ungegated.

---

## 🟡 N5 — Ein Preis für sehr unterschiedliche Nutzungsintensität

Ein Einzelunternehmer mit fünf Rechnungen im Monat und eine GbR mit drei Gesellschaftern, zwei
Firmen und Lagerverwaltung zahlen **beide 15 €**. Der Nutzen und die Zahlungsbereitschaft
unterscheiden sich erheblich.

Wie schon in [#14 P4](funde-audit-07-product-manager-2026-08-10.md) empfohlen: Falls je gestaffelt
wird, dann **nach Firmenanzahl**, nicht nach Features. Gesetzlich nötige Funktionen wie die
E-Rechnung hinter einen höheren Tarif zu legen, ist genau der Fehler, den Lexware macht
(dort erst ab 32,90 €) — und derzeit Stackrs bestes Verkaufsargument.

**Zwei ungenutzte Umsatzquellen, beide bereits technisch vorbereitet:**

- **Steuerberater-Zugang.** Die Read-only-Freigabe ist gebaut (`js/stb-share.js`, ECDH-Envelope,
  Fingerabdruck-Abgleich) und **kostenlos** — der Steuerberater braucht kein eigenes Abo. Für
  den Mandanten ist das ein Kaufargument. Eine Kanzlei mit 40 Mandanten wäre allerdings ein
  eigenes Preismodell wert. Heute ist dieser Weg zugleich ein Leck
  ([#2 R4](funde-audit-01-red-team-2026-08-10.md): ein Abo kann unbegrenzt Gratis-Zugänge
  erzeugen) — ein Deckel würde beides regeln.
- **Empfehlungsprogramm.** Vollständig verdrahtet: Referral-Link mit `?a=<username>`, Teilen per
  E-Mail und WhatsApp, und — anders als eine ältere Notiz behauptet — **die
  Teilnahmebedingungen existieren**: `agb.html` §11 mit Anker `#empfehlungsprogramm`, korrekt
  aus dem Referral-Dialog verlinkt ([js/whop-auth.js:780](../js/whop-auth.js#L780)). Der Text
  regelt Freiwilligkeit, Pro-Abo-Voraussetzung, Abwicklung über Whop und stellt klar, dass der
  Anbieter nicht Auszahlungsstelle ist. **Das Programm ist einsatzbereit und wird nirgends
  beworben** — es steht nur im Kontomenü.

---

## Gesundheitsscore

| Bereich | Score | Kommentar |
|---|---|---|
| Top-of-Funnel | **4/10** | Local weggefallen, nur Landing + Demo übrig; Kartenpflicht ist die höchste Hürde im Vergleichsfeld |
| Pricing vs. Markt | **7/10** | 15 € liegt über sevDesks 9,90-€-Einstieg, aber unter dessen 17,90-€-Vollpaket — und E-Rechnung ist drin, wo Lexware 32,90 € nimmt. Gut positioniert, schlecht erzählt |
| Checkout-Flow | **8/10** | Landing → Checkout in 2 Klicks, echte Plan-Links verdrahtet, `_recheckOnFocus` erkennt die Zahlung ohne Reload |
| Trial-Erlebnis | **3/10** | Server kennt `trialing`, App zeigt nichts — kein Countdown, keine Vorwarnung vor der Abbuchung (**N2**) |
| Churn-Schutz | **6/10** | Winback-Screen gut gemacht, „Daten bleiben erhalten" ist das stärkste Argument — aber er erreicht nur Rückkehrer |
| Revenue-Diversifikation | **4/10** | Ein Preis, ein Produkt. StB-Zugang und Referral sind gebaut und ungenutzt |

---

## Top-3-Sofortmaßnahmen

```
💰 QUICK WIN 1 — Trial sichtbar machen (N2)
   Aufwand: ~1 Tag (Server-Feld durchreichen + 2 Stummel füllen + UI-Streifen)
   Impact: weniger Rückbuchungen, plus der beste Conversion-Moment wird überhaupt erst nutzbar
   Umsetzung: status/renews_at in die whop-access-Antwort, isTrialActive()/getTrialDaysLeft()
              füllen, Hinweis im Kontomenü + ab Tag 5 im Dashboard

💰 QUICK WIN 2 — Jahresabo als Default (N3)
   Aufwand: ~1 Stunde
   Impact: verschiebt Umsatz nach vorn und senkt die Kündigungsfrequenz, ohne Preisänderung
   Umsetzung: billing-btn-active auf den Jahres-Button, Reihenfolge tauschen
              (das Gate macht es bereits richtig — nur die Landing nachziehen)

💰 QUICK WIN 3 — Zwei Whop-Mails konfigurieren (N4)
   Aufwand: ~1 Stunde, reine Konfiguration im Whop-Backend
   Impact: fängt die Jahresverlängerungs-Überraschung ab und holt Gekündigte zurück
   Umsetzung: 3 Tage vor Verlängerung; 7 Tage nach Kündigung mit dem Hinweis,
              dass die Daten erhalten sind
```

## Strategisch (3–6 Monate)

1. **Demo zum Haupteinstieg machen** statt eines Free-Tiers (N1, Option 1) — die einzige
   Maßnahme, die den weggefallenen Local-Funnel ersetzt, ohne ein zweites Produkt zu pflegen.
2. **Empfehlungsprogramm aktivieren.** Es ist fertig und rechtlich abgesichert, wird aber nirgends
   beworben. Ein Hinweis nach dem dritten erfolgreichen Monat kostet nichts.
3. **Staffelung nach Firmenanzahl prüfen** (N5) — erst wenn es genug Mehr-Firmen-Nutzer gibt,
   um die Grenze empirisch zu setzen. Vorher ist jede Staffel geraten.
4. **Steuerberater-Modell** — zusammen mit dem Grant-Deckel aus R4 angehen. Erst Leck schließen,
   dann Preis dafür verlangen.
