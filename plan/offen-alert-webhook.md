# Offen: `ALERT_WEBHOOK_URL` setzen

**Stand: 2026-09-12.** Kurzfassung mit genau einem offenen Punkt. Das *Wie* steht ausführlich in
[`alert-webhook-anleitung.md`](alert-webhook-anleitung.md), der Zusammenhang in
[`stand-alarm-vercel-2026-09-09.md`](stand-alarm-vercel-2026-09-09.md) — diese Datei wiederholt
beides absichtlich nicht, sie sagt nur, was noch fehlt und woran man merkt, dass es erledigt ist.

## Der Punkt

`ALERT_WEBHOOK_URL` ist in Vercel nicht gesetzt (letzter belegter Stand: 2026-09-10, im Dashboard
nachgesehen). Zwei Schritte, beide in fremden Oberflächen — **keine Session kann das für dich
tun**, weil dafür deine Accounts nötig sind:

1. **Make.com-Szenario anlegen** (~10 Min), Webhook-URL kopieren →
   [Schritte 1–3](alert-webhook-anleitung.md#1-makecom-szenario-anlegen-10-min)
2. **In Vercel eintragen und neu deployen** →
   [Schritt 4](alert-webhook-anleitung.md#4-in-vercel-eintragen)
   Ohne Redeploy greift die Variable nicht. Das ist der häufigste Fehler.

Danach kann eine Session die
[Gegenprobe](alert-webhook-anleitung.md#gegenprobe-nach-dem-deployment) fahren — dafür reicht die
Preview-URL, die Webhook-URL brauche ich nicht und will sie auch nicht.

## Warum es sich trotz Blob-Speicher noch lohnt

Seit 2026-09-10 schreibt `api/_alert.js` jede Meldung zusätzlich unter `stackr/alerts/` in den
Blob-Speicher (30 Tage, ohne Einrichtung aktiv). Der Vorfall **geht** also nicht mehr verloren.

Was weiter fehlt, ist der Weg, der dich von selbst erreicht:

| | Blob-Speicher | Webhook |
|---|---|---|
| Vorfall wird festgehalten | ja | ja |
| Du erfährst davon, ohne hinzusehen | **nein** | ja |

Der Unterschied wird konkret bei `whop-refresh`/`redis-fehlt`: Token-Erneuerung tot, **jeder**
Kunde fliegt nach einer Stunde aus dem Gate. Das steht dann sauber belegt im Blob — und du
erfährst es per Support-Ticket, wenn du nicht zufällig nachsiehst.

## Bis dahin: einmal die Woche nachsehen

Der Lese-Einzeiler steht unter
[Nachsehen, was passiert ist](alert-webhook-anleitung.md#nachsehen-was-passiert-ist). Läuft aus dem
Repo, braucht nur den Token aus `.env.local`, keinen Vercel-Zugriff.

**Leere Liste heißt: nichts gemeldet** — Normalfall und guter Fall. Anders als beim Vercel-Log,
wo Leere auch „ist längst rausgerollt" bedeuten kann; auf dem Hobby-Plan reicht es nur 30 Minuten
bis 1 Stunde zurück.

**Letzte Kontrolle: 2026-09-12 — 0 Alarme**, Speicher erreichbar. Gleichzeitig lief
`node test/test-alert-ops.js` mit 23/23 grün: die Mechanik dahinter ist intakt, es fehlt
weiterhin nur das Ziel.

## Woran man merkt, dass es erledigt ist

- In Vercel steht `ALERT_WEBHOOK_URL` unter Settings → Environment Variables, **und** danach wurde
  deployt.
- Der Testaufruf aus [Schritt 3](alert-webhook-anleitung.md#3-struktur-beibringen--mit-einem-echten-testaufruf)
  ist in Make angekommen.
- Die Gegenprobe hat eine echte Meldung erzeugt (`[Stackr] sync — redis-env-missing`, `env: preview`).

Dann kann diese Datei weg.
