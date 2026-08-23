# Zwei Whop-Mails — fertige Entwürfe (N4)

**Stand: 2026-08-16.** Aufgabe 2.2 aus [`01-AUFGABEN.md`](01-AUFGABEN.md). Reine
Whop-Backend-Konfiguration, kein Code in diesem Repo. Einfügen musst du sie selbst — Claude
meldet sich nicht bei Whop an.

**Anlegen in Whop:** Dashboard → deine Company → *Marketing* bzw. *Automations* → neue
E-Mail-Automation. Auslöser sind die Membership-Ereignisse, nicht ein Datum.

> **Rechtliches, bevor du sendest:** Beide Mails sind **Bestandskunden-Service zum laufenden
> Vertrag**, keine Werbung — sie brauchen deshalb keine gesonderte Einwilligung. Die Winback-Mail
> kippt in Werbung, sobald sie einen Rabatt oder ein Angebot enthält. **Deshalb steht in Entwurf 2
> bewusst kein Rabatt.** Willst du einen, brauchst du §7 Abs. 3 UWG (eigene Ware, Hinweis auf
> Widerspruchsrecht bei jeder Nutzung) oder eine Einwilligung.

---

## 1. Vorwarnung — 3 Tage vor der Jahresverlängerung

**Auslöser:** Membership mit Jahresplan, 3 Tage vor `renewal_date`.
**Warum:** 135 € ohne Vorankündigung ist die Buchung, die zu Rückfragen und Rückbuchungen führt.
Eine Rückbuchung kostet dich Gebühr **und** Konto-Reputation — die Mail ist billiger.

> **Betreff:** Deine Stackr-Verlängerung steht am {{renewal_date}} an
>
> Hallo {{first_name}},
>
> kurze Vorwarnung, damit auf deinem Kontoauszug keine Überraschung steht: Dein Stackr-Jahresabo
> verlängert sich am **{{renewal_date}}** automatisch um zwölf Monate. Abgebucht werden
> **135 € inkl. MwSt.** über die bei Whop hinterlegte Zahlungsart.
>
> Du musst nichts tun — alles läuft weiter wie bisher, deine Daten und Einstellungen bleiben
> unverändert.
>
> **Wenn du nicht verlängern willst,** kündigst du bis zum {{renewal_date}} hier:
> {{manage_membership_url}}
>
> Auch danach bleiben deine Buchhaltungsdaten erhalten — sie liegen in deinem Browser, nicht bei
> uns. Denk in dem Fall trotzdem an ein Backup über *Backup & Daten*, bevor du das Gerät
> wechselst.
>
> Fragen zur Rechnung? Antworte einfach auf diese Mail.
>
> Viele Grüße
> {{dein_name}} — Stackr

**Platzhalter prüfen:** Die Namen der Merge-Tags musst du gegen die Liste in Whop abgleichen,
sie unterscheiden sich je nach Automations-Typ. `{{renewal_date}}` muss auf **deutsches
Datumsformat** stehen.

---

## 2. Winback — 7 Tage nach der Kündigung

**Auslöser:** Membership-Status auf `canceled`/`expired`, +7 Tage.
**Warum:** Der Winback-Screen in der App ist gut gemacht, erreicht aber nur die, die von selbst
zurückkommen. Diese Mail erreicht die anderen. Der Kernsatz ist nicht das Angebot, sondern die
**Beruhigung**: die Daten sind nicht weg.

> **Betreff:** Deine Stackr-Daten sind noch da
>
> Hallo {{first_name}},
>
> dein Stackr-Zugang ist seit einer Woche beendet. Eine Sache, die viele an dieser Stelle nicht
> wissen und die dir Ärger ersparen kann:
>
> **Deine Buchhaltungsdaten sind nicht gelöscht.** Sie liegen dort, wo sie immer lagen — in dem
> Browser, in dem du gearbeitet hast. Wir haben sie nie im Klartext gehabt und deshalb auch nichts
> zu löschen. Kommst du zurück, ist alles da, wo du es verlassen hast.
>
> **Was du jetzt trotzdem tun solltest:** Zieh dir einmal ein Backup über *Backup & Daten →
> Backup erstellen*. Löschst du irgendwann die Browserdaten oder wechselst das Gerät, sind die
> Daten sonst wirklich weg — und deine Aufbewahrungspflicht nach §147 AO läuft zehn Jahre.
>
> Falls dir etwas gefehlt hat oder etwas im Weg war: Antworte auf diese Mail und schreib es mir in
> einem Satz. Ich lese jede Antwort selbst.
>
> Zurückkommen kannst du jederzeit: {{checkout_url}}
>
> Viele Grüße
> {{dein_name}} — Stackr

---

## Wenn du nur eine von beiden baust

**Nimm die Vorwarnung.** Sie verhindert Rückbuchungen bei bereits zahlenden Kunden, die Winback
gewinnt bestenfalls einen Teil der Abgesprungenen zurück. Vorwarnung schützt Bestand, Winback ist
Akquise.
