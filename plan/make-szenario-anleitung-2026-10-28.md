# Make-Szenario Trial-Mails: Bauanleitung

Stand 2026-10-28. Setzt [analyse-email-sequenz-2026-10-26.md](analyse-email-sequenz-2026-10-26.md) um (Mailtexte A1, A2, A4, A5 dort). Nur Trial-Sequenz; Winback bleibt offen. Nichts davon ist in Make angelegt.

**Warum kein fertiges JSON-Blueprint:** Modul-IDs und Parameter ließen sich ohne Referenz-Export nicht belegen; ein geratenes JSON schlägt beim Import eher fehl, als dass es hilft. Stattdessen nur eingebaute Module, die du von Hand anlegst.

## Warum zwei Szenarien

Make-Szenarien können nicht tagelang warten (das Sleep-Modul hat höchstens 5 Minuten). Darum:

- **Szenario 1 "Trial erfassen"** (Webhook): speichert pro neuem Trial einen Datensatz.
- **Szenario 2 "Trial-Mails"** (täglich): liest die Datensätze und verschickt je nach Alter die passende Mail.

Das sind genau die 2 aktiven Szenarien im Free-Plan. Das tägliche Szenario kostet wenige Operationen pro Lauf (1.000 Credits/Monat reichen für den Start).

## Vorbereitung

1. **Data Store** anlegen (Make: Data stores > Add): Name `trial-mails`, Felder:
   `email` (Text, Schlüssel), `vorname` (Text), `plan` (Text), `start` (Datum), `ende` (Datum), `gesendet` (Text, z. B. `A1,A2`), `abgemeldet` (Boolean, Standard nein).
2. **Absender:** ein E-Mail-Konto, das Make nutzen darf (Make-Modul "Email" per SMTP oder "Gmail"). Absenderadresse und Domain (SPF/DKIM) vorher festlegen. Offen, siehe Plan.
3. **Abmelde-Link:** jede Mail braucht ihn. Einfachster Weg: zweiter Webhook "Abmelden" (Szenario 3, würde das 2-Szenarien-Limit sprengen) oder Link `mailto:` mit Betreff "Abmelden", Antworten pflegst du per Hand. Für den Start: `mailto:`-Link, spätere Automatisierung offen.

## Szenario 1: Trial erfassen

1. **Trigger: Webhooks > Custom webhook.** Name `whop-trial`. Adresse kopieren.
2. **In Whop:** Dashboard > Developer > Webhooks > Webhook hinzufügen, Adresse einfügen, Event für "Mitgliedschaft wird gültig" (Name im Dashboard ablesen, vermutlich `membership_went_valid`) wählen. Ein Testereignis auslösen, damit Make die Datenstruktur lernt.
3. **Filter** nach dem Trigger: Status der Mitgliedschaft = `trialing` (Feldname aus dem Testereignis ablesen). So landen zahlende Neukunden ohne Trial nicht in der Liste.
4. **Data store > Add/replace a record:** Schlüssel = E-Mail aus dem Webhook; `start` = `{{now}}`; `ende` = `{{addDays(now; 7)}}` (oder `renews_at` aus Whop, falls geliefert); `vorname`, `plan` aus den Webhook-Feldern.
5. **Email/Gmail > Send email:** Mail A1 sofort (Text aus dem Plan), danach Data store > Update record: `gesendet` = `A1`.
6. Szenario speichern, Zeitplan "Immediately", aktivieren.

**Beenden bei Kündigung:** zweiter Whop-Event "Mitgliedschaft wird ungültig" ist ein weiteres Szenario. Im Free-Plan nicht möglich. Ersatz: In Szenario 2 pro Datensatz per HTTP-Modul prüfen, oder Datensatz nach Tag 8 ignorieren (siehe Filter unten). Wer vorher kündigt, bekommt A4/A5 noch, das ist bei Vertragsinformation vertretbar, aber im Text neutral halten ("falls du schon gekündigt hast, ignoriere diese Mail").

## Szenario 2: Trial-Mails (täglich)

1. **Trigger:** Zeitplan "Every day", 09:00.
2. **Data store > Search records:** Filter `abgemeldet` = nein UND `ende` >= heute minus 1 Tag.
3. **Router** mit vier Zweigen; jeder Zweig hat einen Filter, der Alter in Tagen berechnet `{{dateDifference(now; start; "days")}}`:
   - Tag 1 und `gesendet` enthält nicht `A2`: Mail **A2**.
   - Tag 3 und nicht `A3`: Mail **A3** (an alle, Formulierung "Falls du noch nicht gestartet bist").
   - Tag 5 und nicht `A4`: Mail **A4** (Datum, Plan und Preis aus dem Datensatz).
   - Tag 6 und nicht `A5`: Mail **A5**.
4. In jedem Zweig: **Email > Send email**, dann **Data store > Update record** (`gesendet` = bisheriger Wert plus `,A2` usw.). Das `gesendet`-Feld verhindert Doppelversand bei Wiederholung.
5. Fehlerbehandlung: auf dem Mailmodul "Ignore" bzw. Fehler-Route, damit ein ungültiger Empfänger nicht den ganzen Lauf stoppt.

## Pflichtbestandteile jeder Mail

- Absender mit Namen, Impressumsdaten im Footer (Name, Anschrift, wie im [Impressum](../impressum.html)).
- Abmeldelink oder -hinweis, Verweis auf die [Datenschutzerklärung](../datenschutz.html).
- A4/A5 mit Preis und Kündigungsweg wie im Checkout (15 € monatlich / 135 € jährlich, Endpreis, keine USt nach § 19 UStG).

## Testen, bevor du aktivierst

1. Szenario 1 mit Whop-Testereignis ausführen, Datensatz prüfen.
2. Datensatz auf deine eigene Adresse setzen, `start` auf gestern/vorgestern/5 Tage zurück, Szenario 2 einmal "Run once": je Alter muss genau die passende Mail ankommen und `gesendet` sich füllen.
3. Zweiter Lauf direkt danach: es darf nichts mehr gesendet werden.

## Offen

- Genauer Whop-Eventname und ob `renews_at` im Webhook steckt (im Dashboard nachsehen).
- Absenderadresse/-domain.
- Abmeldeverwaltung: nur per Hand, bis ein drittes Szenario (Bezahl-Plan) bzw. Alternative gebaut ist.
- Datenschutzerklärung und AVV für Make als Mailversender ergänzen (Rechtsteil im Hauptplan).
- Winback weiterhin nicht bauen.
