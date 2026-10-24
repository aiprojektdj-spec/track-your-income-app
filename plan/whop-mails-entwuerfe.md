# Zwei Whop-Mails — fertige Entwürfe (N4)

**Stand: 2026-08-16, gegen den Code nachgezogen 2026-10-14** (Preis inkl. USt seit Whop-Umstellung 2026-10-16, Backup-Knopf,
Cloud-Sync, §147 AO 8/10 Jahre). Aufgabe 2.2 aus [`01-AUFGABEN.md`](01-AUFGABEN.md). Reine
Whop-Backend-Konfiguration, kein Code in diesem Repo. Einfügen musst du sie selbst — Claude
meldet sich nicht bei Whop an.

**Anlegen in Whop:** Dashboard → deine Company → *Marketing* bzw. *Automations* → neue
E-Mail-Automation. Auslöser sind die Membership-Ereignisse, nicht ein Datum.

> **Rechtliches, bevor du sendest:** Beide Mails sind **Bestandskunden-Service zum laufenden
> Vertrag**, keine Werbung — sie brauchen deshalb keine gesonderte Einwilligung. Die Kündigungsmail
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
> **135 € (inkl. 19 % USt)** über die bei Whop hinterlegte Zahlungsart.
>
> Du musst nichts tun — alles läuft weiter wie bisher, deine Daten und Einstellungen bleiben
> unverändert.
>
> **Wenn du nicht verlängern willst,** kündigst du bis zum {{renewal_date}} hier:
> {{manage_membership_url}}
>
> Auch danach bleiben deine Buchhaltungsdaten erhalten — sie liegen in deinem Browser. Nach dem
> Ende des Abos kommst du aber nicht mehr in die App: Zieh dir deshalb **vor** dem
> {{renewal_date}} ein Backup über *Backup & Daten → Backup herunterladen*.
>
> Fragen zur Rechnung? Antworte einfach auf diese Mail.
>
> Viele Grüße
> {{dein_name}} — Stackr

**Platzhalter prüfen:** Die Namen der Merge-Tags musst du gegen die Liste in Whop abgleichen,
sie unterscheiden sich je nach Automations-Typ. `{{renewal_date}}` muss auf **deutsches
Datumsformat** stehen.

---

## 2. Kündigungsbestätigung — sofort bei Eingang der Kündigung

**Auslöser:** Kündigung eingegangen (`cancel_at_period_end` bzw. das Whop-Ereignis „Membership
canceled", solange der Zugang noch läuft) — **nicht** erst nach Ablauf.
**Warum so früh:** Nach dem Ende des Abos sperrt das Whop-Gate die ganze App, auch *Backup &
Daten*. Ein Backup-Hinweis sieben Tage nach Ablauf (alte Fassung dieses Entwurfs) liefe ins
Leere. Entscheidung User 2026-10-14: Mail bei Kündigung statt Backup-Knopf im Sperrbildschirm.
Der Kernsatz bleibt die **Beruhigung**: die Daten sind nicht weg — plus die Frist fürs Backup.

> **Betreff:** Deine Kündigung — und was mit deinen Daten passiert
>
> Hallo {{first_name}},
>
> deine Kündigung ist angekommen. Dein Stackr-Zugang läuft noch bis zum **{{expiry_date}}**.
>
> **Deine Buchhaltungsdaten werden nicht gelöscht.** Sie liegen dort, wo sie immer lagen — in dem
> Browser, in dem du gearbeitet hast. Hattest du Cloud-Sync an, liegt zusätzlich eine
> verschlüsselte Kopie bei uns, die wir nicht lesen können. Kommst du zurück, ist alles da, wo du
> es verlassen hast.
>
> **Eine Sache solltest du bis zum {{expiry_date}} erledigen:** Zieh dir ein Backup über
> *Backup & Daten → Backup herunterladen*. Danach kommst du ohne Abo nicht mehr in die App.
> Löschst du irgendwann die Browserdaten oder wechselst das Gerät, sind die Daten ohne Backup
> wirklich weg — und deine Aufbewahrungspflicht nach §147 AO läuft bis zu zehn Jahre.
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

**Nimm die Vorwarnung.** Sie verhindert Rückbuchungen bei bereits zahlenden Kunden, die Kündigungsmail
sichert den Gekündigten das Backup. Beide sind Service, keine Werbung — solange kein Rabatt drinsteht.

---

## 3. Einmalig: Neuer Speicherort für den Cloud-Sync (Stand 2026-10-24)

Aus `plan/rechtsaudit-2026-10-24.md` (A5, DSE Ziffer 9: „Bei wesentlichen Änderungen informieren
wir registrierte Nutzer per E-Mail“). **Keine Automation**, sondern eine einmalige Nachricht an
alle aktiven Mitglieder (Whop → Marketing → neue E-Mail bzw. Broadcast). Reine Pflicht-Information,
keine Werbung — deshalb ohne Angebot, ohne Rabatt, ohne Link auf Upgrades. Der gleiche Inhalt
erscheint in der App einmal als Fenster bei allen, die den Cloud-Sync aktiv haben.

**Betreff:** Stackr: neuer Speicherort für deinen Cloud-Sync

> Hallo,
>
> kurze Information zu deinem Stackr-Konto: Seit Oktober 2026 speichern wir die verschlüsselten
> Daten des Cloud-Sync zusätzlich bei **Supabase** (Supabase, Inc.) in Frankfurt am Main (EU). Wir
> ziehen den Speicher damit von Upstash zu Supabase um; nach Abschluss des Umzugs löschen wir die
> Daten bei Upstash.
>
> **An der Verschlüsselung ändert sich nichts.** Deine Daten werden weiterhin auf deinem Gerät
> verschlüsselt, den Schlüssel hast nur du. Auch Supabase sieht nur unlesbares Chiffrat.
>
> Nutzt du den Cloud-Sync nicht, betrifft dich die Änderung nur bei der Anmeldung: Deine
> Login-Sitzung liegt jetzt ebenfalls verschlüsselt bei Supabase in Frankfurt.
>
> Die aktualisierte Datenschutzerklärung (Ziffern 4, 5 und 7) findest du unter
> https://getstackr.de/datenschutz.html. Fragen? Antworte einfach auf diese Mail oder schreib an
> secondlife.vintage07@gmail.com.
>
> Viele Grüße
> Jonathan von Stackr

**Hinweis:** Der Satz zur Login-Sitzung gilt für alle Nutzer (`whop_sessions` wird unabhängig vom
Cloud-Sync gespiegelt), deshalb geht die Mail an alle aktiven Mitglieder, nicht nur an Sync-Nutzer.
