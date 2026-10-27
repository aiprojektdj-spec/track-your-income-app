# E-Mail-Sequenzen Stackr: Trial + Winback (Entwurf)

Stand 2026-10-26. Nur Entwurf, nichts eingerichtet, nichts gesendet. Quellen: `index.html` (Landingpage), `js/`, `api/`, `datenschutz.html`. Keine Plandateien als Grundlage.

## 0. Rahmen aus dem Code

- **Anrede: Du** (Landingpage durchgehend "deine Buchhaltung", "du kündigst"). Ton: ruhig, klar, ohne Ausrufezeichen-Marketing. Marke klein: "stackr".
- **Preis:** 15 € monatlich oder 135 € jährlich, Endpreis, keine USt (§ 19 UStG). 7 Tage kostenlos, einmalig für Neukunden, Zahlungsmittel nötig, danach automatische Verlängerung. Kündigung über Whop zum Ende des bezahlten Zeitraums; im Trial wird bei Kündigung nichts fällig.
- **Checkout-Link:** `https://whop.com/checkout/plan_iR6YIKLcychSZ`. Kündigungsseite: `kuendigen.html` ("Verträge hier kündigen").
- **Zielgruppe:** Selbstständige, Freelancer, Kleinunternehmer, Reseller (Vinted/Flohmarkt-Beispiele auf der Landingpage), GbR.
- **Features, die die Mails nennen dürfen (alle auf der Landingpage oder im Code belegt):** Buchungen/Einnahmen/Ausgaben, Rechnungen als PDF und XRechnung, Belege (lokale OCR, `js/beleg-ocr.js`), Lager, EÜR, Export PDF/CSV/DATEV, Bank-Import (`js/bank-import.js`), Shopify-Import (`js/shopify-import.js`), optionaler E2E-Cloud-Sync, Steuerberater-Lesezugang, Backup.
- **Nicht versprechen:** ELSTER-Übermittlung (die Landingpage sagt ausdrücklich "erfolgt separat"), Steuerersparnis, "finanzamtsicher", Steuerrat jeder Art. Keine Rabatte oder Gratismonate erfinden: im Code existiert keine Winback-Aktion.
- **Datenlage:** Buchhaltungsdaten liegen lokal im Browser. Jede Mail zu Daten/Backup muss das richtig wiedergeben (Backup erstellt der Nutzer selbst).

## 1. Sequenz A: 7-Tage-Trial

**Ziel:** Aktivierung innerhalb der Testphase (erste Buchung oder Rechnung, idealerweise ein Import), danach bewusste Entscheidung statt Überraschungsabbuchung.
**Auslöser:** Whop-Mitgliedschaft mit Status `trialing` entsteht (Tag 0 = Checkout).
**Exit:** Kündigung (dann Sequenz B) oder Trial-Ende (Wechsel auf `active`, Mail A5 entfällt, A6 optional).

| # | Zeitpunkt | Zweck | CTA |
|---|---|---|---|
| A1 | Tag 0, sofort | Willkommen, Orientierung, Trial-Eckdaten | App öffnen |
| A2 | Tag 1, morgens | Aktivierung: erste Rechnung oder erster Import | Erste Buchung/Import anlegen |
| A3 | Tag 3, nur wenn noch nichts erfasst | Hürde senken, Hilfe anbieten | Import wählen |
| A4 | Tag 5 (2 Tage vor Ende) | Erinnerung vor Trial-Ende, Datum und Preis | Abo verwalten (Whop) |
| A5 | Tag 6 (letzter Tag) | Letzter Tag, Kündigungsweg offen nennen | App öffnen / Kündigen |

### A1 Willkommen (Tag 0)
- **Betreff:** Willkommen bei stackr (Alternativen: "Dein Testzugang läuft", "Los geht's mit deiner Buchhaltung")
- **Preheader:** Deine 7 Tage laufen. Hier ist der schnellste Einstieg.
- **Text:**
  > Hallo {{Vorname}},
  >
  > schön, dass du stackr testest. Dein kostenloser Testzeitraum läuft bis {{Trial-Ende, Datum}}.
  >
  > Am schnellsten siehst du, ob stackr zu dir passt, wenn du zwei Dinge tust:
  > 1. Eine Einnahme oder Ausgabe erfassen (dauert eine Minute).
  > 2. Eine Rechnung schreiben und als PDF ausgeben.
  >
  > Deine Daten liegen zuerst lokal in deinem Browser. Lade deshalb ab und zu ein Backup herunter, das erstellst und verwahrst du selbst.
  >
  > Fragen? Antworte einfach auf diese Mail.
  >
  > {{Absender}}
- **CTA:** "stackr öffnen" -> App-URL (`app.html`).
- **Hinweis:** Trial-Ende-Datum nur nennen, wenn aus `renews_at` (siehe `api/whop-access.js`) sicher ableitbar, sonst "in 7 Tagen".

### A2 Aktivierung (Tag 1)
- **Betreff:** Deine erste Rechnung in 3 Minuten (Alt: "Starte mit einem Import statt mit leeren Tabellen")
- **Preheader:** Oder bring deine Zahlen per Import mit.
- **Text:**
  > Hallo {{Vorname}},
  >
  > leere Buchhaltung ist der schwerste Teil. Zwei Wege, ihn zu überspringen:
  >
  > **Du schreibst Rechnungen?** Lege einen Kunden an, erfasse die Leistung, gib die Rechnung als PDF oder XRechnung aus. Als Kleinunternehmer setzt stackr den Hinweis nach § 19 UStG.
  >
  > **Du verkaufst über Shopify oder hast Kontoauszüge?** Importiere sie, statt alles abzutippen (Shopify-Import und Bank-Import).
  >
  > Danach siehst du auf deiner Übersicht sofort Einnahmen, Ausgaben und Gewinn.
- **CTA:** "Erste Rechnung schreiben" -> `app.html` (Rechnungen).
- **Hinweis:** Hinweis-Satz zu § 19 UStG nur, wenn Kleinunternehmer-Einstellung als Segment bekannt ist; sonst weglassen. Segment-Varianten (Reseller/Freelancer/GbR) sind optional A/B.

### A3 Hürde senken (Tag 3, nur ohne erfasste Daten)
- **Betreff:** Hängst du irgendwo fest?
- **Preheader:** Drei Antworten auf die häufigsten Startfragen.
- **Text:**
  > Hallo {{Vorname}},
  >
  > mir ist aufgefallen, dass du noch nichts erfasst hast. Das ist normal, am Anfang fehlt meist nur der erste Schritt.
  >
  > - Du weißt nicht, wo anfangen? Erfasse nur die letzte Einnahme.
  > - Belege liegen als Foto vor? Die Texterkennung läuft lokal im Browser, deine Belege gehen dafür nirgends hin.
  > - Du arbeitest mit Steuerberater? Du kannst Auswertungen als PDF/CSV und Buchungen als DATEV-Export übergeben.
  >
  > Schreib mir, was nicht klappt. Ich antworte persönlich.
- **CTA:** "Einnahme erfassen" -> `app.html`.
- **Bedingung:** Nur senden, wenn serverseitig bekannt wäre, dass nichts erfasst wurde. **Achtung:** Das ist technisch nicht möglich (siehe 3.), weil Daten lokal liegen. Fallback: A3 an alle senden, Formulierung dann ohne "mir ist aufgefallen" ("Falls du noch nicht gestartet bist ...").

### A4 Erinnerung vor Ende (Tag 5)
- **Betreff:** Dein Test endet in 2 Tagen (Alt: "Was nach deinem Testzeitraum passiert")
- **Preheader:** Kurz und transparent: Datum, Preis, Kündigung.
- **Text:**
  > Hallo {{Vorname}},
  >
  > dein kostenloser Testzeitraum endet am {{Datum}}. Damit du nicht überrascht wirst:
  >
  > - Wenn du nichts tust, geht der Test in dein Abo über: {{15 € monatlich / 135 € jährlich, je nach gewähltem Plan}}, Endpreis, keine USt nach § 19 UStG.
  > - Das Abo verlängert sich automatisch. Du kannst jederzeit über Whop zum Ende des bezahlten Zeitraums kündigen.
  > - Kündigst du vor Ablauf des Tests, wird nichts fällig.
  >
  > Wenn stackr für dich passt: nichts weiter zu tun. Wenn nicht: kein Problem, die Kündigung geht in einer Minute.
- **CTA:** "Mitgliedschaft verwalten" -> Whop-Konto bzw. `kuendigen.html` als zweiter Link im Text (kein zweiter Button).
- **Rechtlich:** Diese Mail ist eine Vertragsinformation, kein Werbemail-Inhalt. Sie sollte immer gesendet werden, auch wenn jemand Marketing abgelehnt hat.

### A5 Letzter Tag (Tag 6)
- **Betreff:** Morgen endet dein Test (Alt: "Letzte Erinnerung: Testzeitraum endet {{Datum}}")
- **Preheader:** Sichere vorher dein Backup, falls du aufhören willst.
- **Text:**
  > Hallo {{Vorname}},
  >
  > morgen, am {{Datum}}, endet dein Testzeitraum.
  >
  > Wenn du bleibst, musst du nichts tun. Wenn du aufhören möchtest, kündige vorher, dann wird nichts abgebucht. Den Link findest du unten.
  >
  > Egal, wie du dich entscheidest: Lade dir vorher ein Backup deiner Daten herunter. Deine Buchhaltung liegt in deinem Browser, ein Backup erstellst und verwahrst du selbst.
  >
  > Danke fürs Testen.
- **CTA:** "Backup herunterladen" -> `app.html` (Einstellungen/Backup). Sekundärlink: "Hier kündigen" -> `kuendigen.html`.

## 2. Sequenz B: Winback nach Kündigung (3 Mails)

**Auslöser:** Mitgliedschaft endet (Whop-Status nicht mehr `active`/`trialing`), nicht bei Kündigung wegen Zahlungsausfall ohne Rücksprache (dort Support statt Winback).
**Exit:** Neuer Checkout / Mitgliedschaft wieder aktiv, Abmeldung, Beschwerde/Widerspruch.
**Wichtig:** Das ist Werbung (siehe 4.). Nur mit rechtlicher Grundlage senden; Anzahl und Zeitraum eng halten.

| # | Zeitpunkt | Zweck | CTA |
|---|---|---|---|
| B1 | 7 Tage nach Ende | Feedback, ohne Verkaufsdruck | Antwort / 1-Klick-Umfrage |
| B2 | 30 Tage nach Ende | Was seither neu ist (nur belegte Neuerungen) | Wieder starten |
| B3 | 90 Tage nach Ende | Letzte Mail, Tür offen, Abmeldung bestätigen | Wieder starten |

### B1 Feedback (Tag 7)
- **Betreff:** Was hat bei stackr gefehlt?
- **Preheader:** Zwei Minuten, die uns wirklich weiterhelfen.
- **Text:**
  > Hallo {{Vorname}},
  >
  > dein stackr-Zugang ist ausgelaufen. Ich würde gern verstehen, warum.
  >
  > Was war der Hauptgrund?
  > - Funktion fehlte: welche?
  > - Zu teuer
  > - Ich brauche es gerade nicht
  > - Etwas anderes
  >
  > Antworte einfach mit einem Satz. Ich lese jede Antwort.
  >
  > Falls du noch Daten sichern möchtest: Dein Backup und deine Exporte (PDF, CSV, DATEV) kannst du mit einer aktiven Mitgliedschaft jederzeit erstellen.
- **CTA:** Reply-to oder Link auf Umfrage. Kein Verkaufs-Button.
- **Annahme:** Ob nach Ablauf noch Lesezugriff/Export möglich ist, steht nicht im Code verifiziert (Hard-Gate). Daher der letzte Satz bewusst so formuliert; vor Versand prüfen und anpassen.

### B2 Was neu ist (Tag 30)
- **Betreff:** Neu bei stackr seit deiner Kündigung
- **Preheader:** Kurz, was sich getan hat.
- **Text:**
  > Hallo {{Vorname}},
  >
  > seit du gegangen bist, hat sich bei stackr einiges getan: {{2-3 tatsächlich ausgelieferte Neuerungen, aus dem Changelog zum Versandzeitpunkt, nicht vorab festschreiben}}.
  >
  > stackr kostet weiterhin 15 € monatlich oder 135 € jährlich (Endpreis, keine USt nach § 19 UStG). Einen Testzeitraum gibt es nur einmalig für Neukunden, dein Wiedereinstieg läuft daher direkt ins Abo.
  >
  > Wenn es für dich wieder passt, bist du in einer Minute dabei.
- **CTA:** "Wieder mit stackr starten" -> Checkout-Link.
- **Hinweis:** "Einmalig für Neukunden" steht so auf der Landingpage; Whop-Trial-Regel für Rückkehrer vor Versand prüfen, sonst Satz streichen. Keine erfundenen Rabatte.

### B3 Abschied (Tag 90)
- **Betreff:** Letzte Mail von stackr
- **Preheader:** Danach hörst du von uns nichts mehr.
- **Text:**
  > Hallo {{Vorname}},
  >
  > das ist meine letzte Mail an dich. Danach melde ich mich nur, wenn du es willst.
  >
  > Falls du irgendwann wieder Einnahmen, Rechnungen und EÜR an einem Ort haben möchtest: stackr ist da.
  >
  > Alles Gute für dein Geschäft.
- **CTA:** "Wieder starten" -> Checkout-Link. Zusätzlich Abmeldelink (Pflicht, siehe 4.).

## 3. Technische Umsetzung (Optionen, nichts eingerichtet)

**Ausgangslage im Repo:**
- Stackr hat **keinen eigenen Mailversand und keine Empfängerliste**. Die E-Mail-Adresse des Kunden kennt Whop; im Code taucht sie serverseitig nur in `api/kuendigung.js` auf (Whop-API-Abfrage und Bestätigungsmail).
- `api/kuendigung.js` verschickt die Kündigungsbestätigung **über Make.com** (per `ALERT_WEBHOOK_URL`, Make-Szenario sendet die Mail). Das ist das einzige bestehende Mailmuster.
- `js/webhooks.js` ist etwas anderes: client-seitige Make-Webhooks, die der **Nutzer selbst** einträgt (Einnahme/Rechnung/Eigenbeleg). Dafür ungeeignet, weil Browser-Events nichts über Trial-Zeitpunkte wissen, und die Daten sind Nutzerdaten, nicht Marketingdaten.
- Der Server weiß nicht, ob jemand schon Buchungen erfasst hat (local-first, Sync nur Chiffrat). **Aktivitätsbasierte Branches (A3 "nur wenn nichts erfasst") sind daher nicht ohne Weiteres möglich.** Verhaltensabfragen gäbe es nur über Opt-in-Tracking im Client, das datenschutzrechtlich neu bewertet werden müsste.

| Weg | Was geht | Offene Punkte |
|---|---|---|
| **A) Whop-eigene Mails** | Whop sendet Zahlungs-/Trial-Transaktionsmails selbst. Reicht für "Kauf bestätigt", nicht für A2/A3/B-Serie. | Umfang und Anpassbarkeit in Whop-Dashboard prüfen (nicht im Repo belegt). |
| **B) Make.com-Szenario mit Whop-Trigger** | Make-Szenario hört auf Whop-Events (Mitgliedschaft aktiviert/Trial gestartet/beendet/gekündigt), wartet pro Mail per Delay und sendet über Mailmodul. Keine Codeänderung nötig. | Verfügbarkeit der Whop-Events/-Webhooks in Make prüfen. Make.com wird in der Datenschutzerklärung für Kündigungsbestätigung genannt; ob ein AVV besteht und Marketing-Mails abdeckt, ist zu prüfen. Make-Operations-Kontingent beachten. Abmeldeverwaltung (Liste suppressed) muss selbst geführt werden, z. B. Make-Datastore. |
| **C) Eigener Cron-Endpunkt** (`api/…`, Vercel Cron) | Liest Whop-API-Mitgliedschaften (wie `kuendigung.js`, Scopes `member:email:read` vorhanden), berechnet Tage seit Start/Ende, ruft Mailversand (Make-Webhook oder Mailanbieter). | Wäre der achte Endpunkt (bisher 7); neue Abhängigkeit/Anbieter nur nach Rückfrage (CLAUDE.md Regel 6). Abmeldestatus müsste gespeichert werden (Supabase möglich). |

**Empfehlung (kleinste Lösung):** B für A1, A4, A5 (reine Zeitlogik, Vertragsinformation), A2 ebenfalls zeitgesteuert. A3 streichen oder ohne Aktivitätsbedingung an alle. Winback (B1-B3) erst nach rechtlicher Klärung (4.), nicht vorher bauen.

## 4. Rechtliche Hinweise (zur Prüfung durch Anwalt, keine Rechtsberatung)

1. **Werbung per E-Mail braucht grundsätzlich Einwilligung** (§ 7 Abs. 2 Nr. 3 UWG, Double-Opt-in empfohlen). **Ausnahme § 7 Abs. 3 UWG** (Bestandskunden): Adresse im Zusammenhang mit dem Verkauf erhalten, Werbung für **eigene ähnliche** Waren/Dienstleistungen, Kunde hat nicht widersprochen, und er wurde bei Erhebung **und bei jeder Verwendung** klar auf das Widerspruchsrecht hingewiesen (jede Mail: Abmeldelink, kostenfrei, ohne andere als Übermittlungskosten).
2. **Sequenz A** besteht überwiegend aus Vertrags-/Serviceinformation (Willkommen, Trial-Ende, Preis, Kündigung). Tipp-Mails (A2/A3) sind Grenzfall; mit Abmeldelink und neutralem Ton versenden, A4/A5 gelten als Informationspflicht-nah.
3. **Sequenz B (Winback)** ist Werbung an ehemalige Kunden. § 7 Abs. 3 UWG ist hier unsicherer: Die Adresse stammt aus einem Vertrag, aber ob nach Ende noch "Kunde" im Sinne der Norm gilt und die Frist angemessen bleibt, ist umstritten. Konservativ: nur mit Einwilligung (Checkbox im Whop-Checkout oder Opt-in in der App) oder höchstens B1 (Feedbackbitte, ohne Angebot) ohne Einwilligung, und selbst das vorher anwaltlich bestätigen. B2/B3 nur mit Opt-in.
4. **Pflichtbestandteile jeder Marketingmail:** Impressumsangaben im Footer, eindeutiger Absender, kein verschleierter Werbecharakter, **Abmeldelink**, Verweis auf Datenschutz.
5. **DSGVO:** `datenschutz.html` nennt Make.com bisher nur für Fehlermeldungen und Kündigungsbestätigung/Kontaktformular. Für Marketing-Mails Abschnitt ergänzen (Zweck, Rechtsgrundlage Art. 6 Abs. 1 lit. a bzw. f, Speicherdauer, Widerruf) und AVV mit Make.com bzw. Mailanbieter prüfen. Keine Nutzerbuchhaltungsdaten in Mailtools geben (nur Vorname, E-Mail, Plan, Datum).
6. **Preis- und Vertragsangaben** in A4/B2 müssen mit Checkout/AGB übereinstimmen; im Zweifel verbindlich ist das Angebot im Checkout (so auch auf der Landingpage).
7. **Keine Steuerberatung:** Texte erklären Funktionen, geben keine steuerliche Empfehlung. Der § 19-Hinweis in A2 ist Funktionsbeschreibung, keine Beratung.
8. Aussagen wie "wir lesen jede Antwort" nur verwenden, wenn der Postfachprozess das trägt.
9. Wenn jemand bei einem Trial-Mail abmeldet: Marketing-Mails aus, Vertrags-/Pflichtinformationen (A4/A5) bleiben zulässig.

## 5. Messung und Tests

- **Primär A:** Trial -> bezahlt (aus Whop). **Primär B:** reaktivierte Mitgliedschaften. Benchmarks aus dem Skill: Onboarding-Öffnung 50-70 %, Winback 15-20 %, Conversion Winback 1-3 %. Bei kleiner Liste wenig aussagekräftig.
- **A/B-Ideen:** Betreff A4 "Dein Test endet in 2 Tagen" gegen "Was nach deinem Testzeitraum passiert"; A2 CTA "Erste Rechnung schreiben" gegen "Import starten"; B1 persönliche Plaintext-Mail gegen Umfrage-Link.
- **Tracking-Hinweis:** Öffnungs-/Klicktracking verlangt Einwilligung bzw. Hinweis in Datenschutzerklärung; ohne Tracking nur Whop-Conversion messen.

## 6. Annahmen und offene Punkte

- **Entscheidung User 2026-10-27:** Versand per Make.com-Szenario (Weg B). Winback offen, bis dahin nicht bauen.

- **Annahme:** Du-Anrede wie Landingpage; Absender "stackr" oder persönlich, Name offen.
- **Annahme:** Trial-Ende-Datum ist aus Whop (`renews_at`) lesbar; sonst "in 7 Tagen".
- **Offen:** Zugriff nach Kündigung (Export/Backup) nicht im Code belegt, B1-Satz prüfen.
- **Offen:** Whop-Events/Webhooks und Whop-Standardmails im Dashboard nicht geprüft.
- **Offen:** Einwilligungs-Mechanismus (Whop-Checkout-Checkbox?) existiert nicht, Winback hängt daran.
- **Offen:** Absenderadresse/-domain (SPF/DKIM) für Versand; derzeit nur Kontaktadresse aus `api/kuendigung.js` bekannt.
- **Offen:** Aktivitätsbasierte Segmentierung (nichts erfasst) technisch nicht vorgesehen.
- Alle Mailtexte sind Entwürfe, vor Versand rechtlich und fachlich gegenlesen.
