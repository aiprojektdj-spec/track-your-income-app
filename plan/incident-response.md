# Stackr: Ablaufplan bei Sicherheitsvorfällen

Stand 03.10.2026. Gilt für alles, was Kundendaten, Zugänge oder die Zahlungsfreischaltung betrifft.
Herkunft: [sicherheit-15-punkte-2026-10-03.md](sicherheit-15-punkte-2026-10-03.md), Punkt 14.

## Was als Vorfall gilt

- Ein Schlüssel aus der Liste unten ist irgendwo gelandet, wo er nicht hingehört (Git, Chat,
  Screenshot, Log, fremder Rechner).
- Jemand hat ohne Abo Zugriff auf Cloud-Sync oder Blob-Speicher bekommen.
- Ein Kunde meldet fremde Daten in seinem Konto oder eigene Daten, die fehlen.
- Der Alarmweg (`api/_alert.js`) meldet einen offenen Deckel, der nicht durch einen
  Anbieter-Ausfall erklärbar ist.
- Ungewöhnliche Last: Upstash-Kontingent oder Blob-Speicher springen ohne Kundenzuwachs.

Im Zweifel als Vorfall behandeln. Abblasen ist billiger als zu spät reagieren.

## Die ersten 60 Minuten

1. **Zeitpunkt notieren.** Ab dem Moment, in dem du davon weißt, läuft die 72-Stunden-Frist
   (Art. 33 DSGVO).
2. **Eindämmen.** Den betroffenen Schlüssel sofort rotieren (Tabelle unten). Bei unklarer Lage:
   Vercel → Deployments → letztes bekanntes gutes Deploy → *Promote to Production*.
3. **Beweise sichern, nicht löschen.** Vercel-Logs (Hobby: nur 1 Stunde!) sofort kopieren,
   Screenshots von Upstash- und Blob-Nutzung. Erst danach aufräumen.
4. **Notizen in `plan/vorfall-JJJJ-MM-TT.md`:** was, wann, welche Systeme, welche Datenarten,
   wie viele Kunden, was schon getan wurde.

## Schlüssel und wo sie rotiert werden

| Variable (Vercel) | Wofür | Rotieren in |
|-------------------|-------|-------------|
| `WHOP_API_KEY` | Abo-Prüfung über die Company-API | Whop Dashboard → Developer → API Keys |
| `WHOP_CLIENT_SECRET` | OAuth-Login | Whop Dashboard → Developer → App → Client Secret |
| `WHOP_GRACE_PRIVATE_KEY` | Signatur der Kulanzfrist | neu erzeugen; der öffentliche Schlüssel im Client muss mitgetauscht werden |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | Sync-Daten, Rate-Limits, Whop-Tokens | Upstash Console → Datenbank → Reset Token |
| `BLOB_READ_WRITE_TOKEN` | Anhänge (Chiffrat) | Vercel → Storage → Blob-Store → Tokens |
| `CRON_SECRET` | Cron-Endpunkte, Alarm-Selbsttest | neuen Zufallswert setzen |
| `ALERT_WEBHOOK_URL` | Alarmweg | beim Webhook-Anbieter neu erzeugen |

Nach jedem Tausch: in Vercel eintragen, neu deployen, `/api/health` prüfen, einmal einloggen und
synchronisieren.

**Gut zu wissen:** Cloud-Sync und Anhänge liegen nur als Chiffrat vor. Ein gestohlener
Redis- oder Blob-Schlüssel gibt Zugriff auf verschlüsselte Daten, nicht auf Klartext-Buchhaltung.
Für die Meldepflicht zählt das (Art. 34 Abs. 3 lit. a DSGVO), die Bewertung bleibt trotzdem nötig.

## Melden: ja oder nein

| Frage | Folge |
|-------|-------|
| Sind personenbezogene Daten betroffen (Whop-ID, E-Mail, Rechnungsempfänger im Klartext)? | Nein → nur intern dokumentieren |
| Ist ein Risiko für die Betroffenen unwahrscheinlich (z. B. nur Chiffrat, Schlüssel sofort getauscht)? | Ja → intern dokumentieren mit Begründung, keine Meldung |
| Sonst | **Innerhalb von 72 Stunden** an den LfDI Baden-Württemberg (Online-Meldeformular auf dessen Website) |
| Hohes Risiko für die Kunden (Klartextdaten, Zugangsdaten) | Zusätzlich die betroffenen Kunden direkt informieren (Art. 34 DSGVO) |

Whop ist für Zahlungsdaten zuständig. Betrifft ein Vorfall Zahlungen, zusätzlich den Whop-Support
informieren.

## Wer uns meldet

Auftragsverarbeiter müssen uns eine Panne bei sich unverzüglich melden (Art. 33 Abs. 2 DSGVO).
Die Meldung kommt an die Konto-E-Mail des jeweiligen Dashboards. Whop ist für den Login
eigenständig verantwortlich und meldet selbst, der Whop-Support ist trotzdem zu informieren.

| Anbieter | Konto / Team | Postfach (geprüft 08.10.2026) |
|----------|--------------|-------------------------------|
| Vercel (inkl. Blob) | Team `aiprojektdj-specs-projects` | aiprojektdj@gmail.com |
| Upstash Redis | Vercel-Marketplace-Store `upstash-kv-cyan-globe`, kein eigenes Upstash-Login | über Vercel: aiprojektdj@gmail.com |

Diese Postfächer müssen gelesen werden. Die 72 Stunden laufen ab dem Lesen der Mail.
Kommt Supabase Storage dazu (`api/_storage.js`), dessen Konto hier nachtragen.

## Vorlage: Meldung an den LfDI

Das Formular fragt die Angaben aus Art. 33 Abs. 3 DSGVO ab. Vorher hier ausfüllen und in die
Vorfallnotiz kopieren. Fehlt etwas noch, trotzdem fristgerecht melden und nachreichen
(Art. 33 Abs. 4).

```text
Verantwortlicher:     [aus dem Impressum]
Ansprechpartner:      [Name, E-Mail, Telefon]
Kenntnis seit:        [Datum, Uhrzeit]   Vorfall seit: [Datum, Uhrzeit oder "unbekannt"]
Was ist passiert:     [z. B. Schlüssel im Git-Verlauf, unberechtigter Zugriff auf Tabelle X]
Datenarten:           [z. B. Name, E-Mail, Profiltext]
Betroffene:           [ungefähre Zahl der Kunden] · Datensätze: [ungefähre Zahl]
Mögliche Folgen:      [z. B. Spam/Phishing an die E-Mail-Adressen]
Schon getan:          [Schlüssel rotiert um ..., Zugriff gesperrt um ...]
Noch geplant:         [z. B. Test gegen Wiederholung, Info an Betroffene]
Betroffene informiert: [ja, am ... / nein, weil ...]
Verspätet (> 72 h)?   [nein / ja, Grund: ...]
```

## Vorlage: E-Mail an Betroffene (nur bei hohem Risiko)

Klare Sprache, keine Beschwichtigung (Art. 34 Abs. 2 DSGVO). Versand einzeln, nicht mit
allen Adressen im Verteiler.

```text
Betreff: Sicherheitsvorfall: Deine Daten bei [Projekt]

Hallo [Name],

am [Datum] haben wir festgestellt, dass [was passiert ist, ein Satz].
Betroffen sind bei dir: [Datenarten].

Was das für dich heißen kann: [z. B. gefälschte Mails in deinem Namen].
Was wir getan haben: [Schlüssel getauscht, Lücke geschlossen, Behörde informiert].
Was du tun kannst: [z. B. auf verdächtige Mails achten, Passwort ändern, falls woanders gleich].

Fragen beantworten wir unter [E-Mail]. Du kannst dich auch beim Landesbeauftragten für
den Datenschutz Baden-Württemberg beschweren.

[Name]
```

## Kein Vorfall? Trotzdem notieren

Auch ein Fehlalarm oder eine Panne ohne Meldung bekommt eine kurze Vorfallnotiz mit der
Begründung, warum nicht gemeldet wurde. Genau diese Begründung will die Behörde später sehen.

## Danach

- Ursache beheben, Test dafür in `test/` schreiben, damit es nicht wiederkommt.
- Regel in `plan/03-ARBEITSREGELN.md` ergänzen, wenn der Vorfall durch die Arbeitsweise entstand.
- Die Vorfallnotiz bleibt liegen (Nachweispflicht Art. 33 Abs. 5 DSGVO).

## KI im Entwicklungsalltag

- Keine echten Kundendaten in Chats mit KI-Werkzeugen: keine Backup-Dateien, keine
  Screenshots mit Kundennamen oder Beträgen, keine Klartext-Logs.
- Schlüssel nie in einen Chat kopieren. Ist es passiert: wie ein Leck behandeln und rotieren.
- Die Production-Schlüssel gehören nicht in die lokale `.env.local`. Lokal braucht die statische
  Seite keinen davon.
