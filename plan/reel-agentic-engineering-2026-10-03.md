# Reel „Vibe Coding vs. Agentic Engineering“: Abgleich Stackr (03.10.2026)

## Quelle

[verycoolentrepreneur, 04.06.2026](https://www.instagram.com/reel/DZLDPGExR-1/), 45 Sekunden.
Overlay: „Vibe coding is for cucks, agentic engineering is for gigachads“.
Whiteboard und Untertitel wurden Frame für Frame ausgelesen.

**Kernaussage:** Vibe Coding heißt „build me an app, make no mistakes“. Agentic Engineering heißt:
Du kennst jede Schicht einer Full-Stack-App und weißt, was schiefgeht, wenn eine fehlt. Am Ende
steht ein Zitat von JiDion: „Don't ride the wave, create the wave.“

**Abgrenzung:** Die Liste auf dem Whiteboard ist eine Teilmenge von
[reels-sicherheit-2026-10-03.md](reels-sicherheit-2026-10-03.md) und
[reel-systemdesign-2026-10-03.md](reel-systemdesign-2026-10-03.md). Hier wird nur geprüft, ob das
Reel etwas Neues bringt. Offene Punkte von dort werden verlinkt, nicht doppelt geführt.
**Stand gegen den Code geprüft am 03.10.2026**, nicht gegen die Plandateien.

## Abgleich Punkt für Punkt

| Whiteboard | Status Stackr | Fundstelle / Begründung |
|---|---|---|
| Frontend: minified | ⚪ bewusst nicht | Kein Build-Schritt, siehe [02-ENTSCHEIDUNGEN.md](02-ENTSCHEIDUNGEN.md) („Kein Bundler, keine Minification“). Vercel komprimiert mit Brotli/Gzip, der Gewinn durch Minification wäre klein, der Preis ein Build-Schritt. **Nicht ändern** |
| Frontend: Secrets sicher gespeichert | ✅ | **Neu geprüft:** `js/`, `app.html`, `index.html` (ohne `vendor/`) enthalten keine Schlüssel. Treffer waren nur ein Kommentar (`BLOB_READ_WRITE_TOKEN` in `js/blob-attachments.js`) und IDs wie `ksk_mitglied`. Alle Secrets liegen in `api/` als Vercel-Env |
| DB (RLS on, Neon) | ✅ anders gelöst | Keine Postgres-DB. Local-first im Browser, Cloud-Sync speichert nur Chiffrat in Upstash, Schlüssel pro Whop-Nutzer. RLS ist hier nicht nötig: Der Server kann die Daten gar nicht lesen |
| Auth (Permissions for users) | ✅ | Whop-OAuth mit Server-Prüfung (`api/whop-access.js`, `whop-token.js`, `whop-refresh.js`), kein Dev-Bypass |
| Version Control (Git) | 🔴 | **`master` ist 15 Commits vor `origin/master` (Stand 13:30), Working Tree schmutzig.** Die Betriebs-Fixes sind nicht live → reels-sicherheit „Wichtigster Fund“ (Push freigeben), danach Branch-Schutz |
| APIs | ✅ | 7 Serverless-Endpunkte in `api/`, Fehler als JSON mit festem Code (`api/_log.js`) |
| Hosting / Deploy | 🔴 | Vercel Hobby verbietet kommerzielle Nutzung → [vercel-pro-2026-10-03.md](vercel-pro-2026-10-03.md) |
| Security | 🟡 | Strenge CSP pro Route in `vercel.json`, HSTS, Vendor-Skripte lokal mit SHA-256 in `js/vendor/VERSIONS.md`. Teile davon sind nicht gepusht → reels-sicherheit Punkt 9 |
| Rate Limiting | ✅ | 5 Endpunkte mit Redis-Deckel, fail-open mit Alarm (`api/_alert.js`), bewusst so entschieden (02-ENTSCHEIDUNGEN) |
| Caching | 🟡 erledigt, nicht live | `/js/*.js` jetzt `max-age=0, must-revalidate`, Vendor behält den Wochen-Cache. Commit `91e35b5` mit Test `test/test-js-cache-header.js` (reel-systemdesign F1). Wird mit dem Push live |
| Scaling (Load Balancer) | ⚪ bewusst nicht | Übernimmt Vercel. Kontingente Upstash/Blob → reels-sicherheit Punkt 15 |
| Error Tracking | 🟡 | `api/_log.js`, `api/client-error.js`, Tagesmeldung im Cron gebaut. Nicht gepusht, Client-Teil braucht Datenschutz-Absatz → reels-sicherheit Punkt 12 |

## Ergebnis

11 Punkte geprüft. **Kein neuer Fix.** Neu geprüft wurde nur „Secrets im Frontend“: sauber.
Minification bleibt bewusst weg.

Alles Rote hängt an zwei Freigaben, nicht an neuem Code:

1. **Push der 15 Commits freigeben.** Das macht Error Tracking, Health-Endpunkt, CSP- und
   Cache-Fix auf einen Schlag live.
2. **Vercel Pro** vor dem Verkauf.

Danach: Branch-Schutz, Uptime-Monitor.

**Nachtrag 13:30:** Der Cache-Fix ist inzwischen von einer parallelen Session umgesetzt
(`91e35b5`). Damit gibt es aus diesem Reel keinen offenen Code-Punkt mehr für Stackr, nur noch
die zwei Freigaben oben.

## Checkliste

- [x] Reel ausgewertet, mit bestehenden Reel-Docs abgeglichen
- [x] Secrets im Client-Code geprüft
- [ ] **Du:** Push der 15 Commits freigeben
- [ ] **Du:** Vercel Pro
- [x] JS-Cache-Fix (reel-systemdesign F1), `91e35b5`, noch nicht live
