# Rest-offen — Stand 2026-08-11

Nachtrag zu `plan/rest-offen-2026-08-09.md` und `plan/OFFEN.md`. Entstanden aus der Session
„UI-Politur-Spiegelung Web → Local" und dem dabei durchgeführten app-weiten Audit.

`OFFEN.md` bewusst nicht angefasst — die Datei war zum Zeitpunkt dieser Session von einer
parallelen Session in Bearbeitung (siehe [Parallelbetrieb](#4-parallelbetrieb-in-local-17) unten).

Kennzeichnung wie in `OFFEN.md`: **[geprüft]** = an Code/Git verifiziert ·
**[Memory]** = aus Projektgedächtnis übernommen, nicht neu verifiziert.

---

## ⛔ Entscheidung 2026-08-11: Local 1.7 wird eingestellt

Der User hat entschieden: **„local soll absofort nicht mehr existieren und auch nicht mehr
beachtet werden"**. Auf Rückfrage präzisiert:

- Der **Ordner bleibt liegen** (eigenes Git-Repo, `main`) — nicht löschen. Er wird nur nicht mehr
  weiterentwickelt.
- **Keine Web→Local-Spiegelung mehr.** Offene Sync-Positionen sind damit *gestrichen*, nicht
  „später zu erledigen".
- Der **Local-Import in Web 1.7 bleibt** (Firmen-Auswahl beim Local-Export) — Migrationspfad für
  Bestandsdaten.

**Damit sind Punkt 1, 2 und 4 dieser Datei erledigt bzw. gegenstandslos.** Was diese Datei noch
wert ist, steht in Punkt 3 (gilt für Web) und Punkt 5 (wartet auf Dritte).

Festgehalten in Memory `local17-eingestellt-2026-08-11`.

**Ein Punkt, der aus der Entscheidung folgt und nicht durch Code lösbar ist:** Laut Memory
`local-sync-backlog-2026-07-25` war Local „wo Geld fließt" — die eigenen Buchungen (Einzel-
unternehmen + GbR) liefen dort. Ob die inzwischen nach Web übernommen wurden, ist nicht
verifiziert. Falls nicht, hängt die eigene Buchhaltung in einer nicht mehr gepflegten App; der
Import-Pfad dafür existiert und bleibt.

---

## Erledigt in dieser Runde (nur zur Abgrenzung)

| Commit | Repo | Inhalt |
|---|---|---|
| `4776251` | Local | 13 UI-Politur-Fixes aus Web gespiegelt + 39 tote Token-Fallbacks + `--warning-rgb`-Farbfehler |
| `abf8c13` | Web | `--warning-rgb`-Farbfehler + zwei rohe Emoji-Buttons (Cross-Session-Fund) |
| `225be0d` | Local | SheetJS 0.20.3 + Backup-Restore-Härtung (fremde Session) |
| `f2cfe0c` | Local | Supabase-Reste entfernt + Teilzahlungen in Dashboard-Summe |

---

## 1. ~~Local-Spiegelung der USt-/Steuer-Fixes~~ — gestrichen 2026-08-11

War der größte offene Posten (`js/store.js`, `js/ausgaben.js`, `js/euer.js`, `js/bilanz.js`,
`js/uva.js`, `js/rechnung.js` — Web und Local inhaltlich auseinandergelaufen). Entfällt mit der
Einstellung von Local ersatzlos. Alle Fixes sind in **Web 1.7** vorhanden; dort war nie etwas
offen. Memory `ust-regelbesteuerung-fixes` ist entsprechend korrigiert.

## 2. ~~Nebenbefunde aus Local~~ — vor der Stilllegung noch gefixt **[geprüft]**

Beide Funde waren echte Altlasten und wurden am 2026-08-11 noch entfernt, weil der Ordner liegen
bleibt und die Dateien weiterhin im Browser geöffnet werden können:

- **Paddle-Leiche** — betraf nicht nur `eigenbelege/index.html`, sondern **vier** Seiten:
  `app.html`, `lager/index.html`, `rechnungen/index.html`, `eigenbelege/index.html` luden jeweils
  `cdn.paddle.com/paddle/v2/paddle.js` **synchron bei jedem Start** und riefen
  `Paddle.Initialize({ token: 'live_…' })` mit einem Live-Token auf — eine Verbindung zu einem
  fremden Server samt IP-Übertragung, für einen Checkout, der seit der Whop-Migration tot und über
  `UserPlan` ohnehin unerreichbar war (`isTrialActive()` gibt konstant `true`). Script-Tags, Token
  und die Paddle-Einträge in allen vier CSP-Metas entfernt (`script-src`, `style-src`, `img-src`,
  `connect-src`, `frame-src` → `'none'`).
- **`js/user-plan.js`** — auf einen Gate-Shim reduziert. Weg sind: der ungeschützte
  `SupabaseDB.getClient()`-Aufruf, der komplette Paddle-Checkout (Live-Token, Preis-IDs,
  Widerrufs-Bestätigung) und die Trial-Mechanik samt „14-tägige Testphase"-Overlay, das durch
  `isTrialActive(){return true}` nie erscheinen konnte. Die API-Fläche, die `store.js`,
  `companies.js` und `lager.js` aufrufen (`isPro`/`isTrialActive`/`requirePro`/`getLimit`), bleibt
  unverändert — kein Verhalten hat sich geändert, nur toter Code ist weg.
- Mitgezogen, weil sonst faktisch falsch: der tote `?upgrade=success`-Zweig in `js/app.js`, die
  CDN-Aufzählung im DSGVO-Hinweis-Modal (`js/app.js`) und `datenschutz.html` §5/§6 (behaupteten,
  Paddle.js lade beim App-Start).

Node-Syntaxcheck bestanden; **nicht committet** — der Ordner ist stillgelegt, und zwei parallele
Sessions haben dort eigene uncommittete Änderungen liegen.

## 3. Bewusst nicht angefasste Hex-Farben — nicht erneut als Fund melden

Gilt unverändert **für Web 1.7** und ist der weiter nützliche Teil dieser Datei. Der app-weite
Audit hat 270 Hex-Farben in JS gefunden; die große Mehrheit ist **korrekt so**: **[geprüft]**

- `js/steuerberater.js` (~59) — baut ein eigenständiges `<!DOCTYPE html>`-Dokument, das per
  `Utils.downloadFile` heruntergeladen wird, mit eigenem `<style>`. CSS-Variablen der App sind
  dort schlicht nicht verfügbar.
- `js/companies.js` (15) — Farbwähler-Palette; der Hex-Wert *ist* die gespeicherte Nutzdatenangabe.
- `js/statistiken.js` (5) — Chart.js zeichnet auf Canvas und kann keine CSS-Variablen auflösen.
- `js/store.js`, `js/akademie.js`, `js/lager.js` (ZICONS/ICONS) — Status- und Icon-Maps, im
  Web-Audit ebenfalls ausgeklammert (`ui-politur-app-weit-2026-08-10`).

Echte Funde in dieser Kategorie sind nur: Verwendungen von `var(--primary)` (das Token existiert
im Set nicht) und `var(--token,#hex)`-Fallbacks, deren Werte veraltet sind. Beide sind in Web
aktuell auf null. Ausnahme: `--warning-rgb` hat als einziges kein definiertes Token, sein Fallback
feuert also wirklich — bei neuen Vorkommen ist das ein echter Bug, kein toter Code.

## 4. ~~Parallelbetrieb in Local 1.7~~ — für Local erledigt, die Lehren gelten für Web

Der Ordner wird nicht mehr bearbeitet, das Kollisionsrisiko dort entfällt. **Web 1.7 wird
weiterhin regelmäßig von mehreren Sessions gleichzeitig beschrieben** — am 2026-08-11 liefen zwei
Sessions parallel im Repo. Die drei Regeln bleiben also in Kraft: **[geprüft]**

- `list_sessions` beim Sessionstart genügt nicht — Sessions kommen danach dazu. Vor dem Commit
  `git status` erneut prüfen.
- Urheberschaft belegen, nicht raten: `search_session_transcripts` nach Dateiname plus
  mtime-Abgleich gegen `lastActivityAt` (Achtung: `lastActivityAt` ist UTC, mtimes lokal,
  CEST = UTC+2).
- Immer pfad-gescoped committen (`git add -- <datei>`), nie `git add -A`.

## 5. Unverändert offen, ohne Code-Anteil

Aus `OFFEN.md` / Memory übernommen: **[Memory]**

- Anwalts-Freigabe: AGB §11, §356-Trial-Klausel, CH-Klauseln in AGB/Datenschutz
- Whop-DPA / AV-Verträge
- Echter 2-Profil-Cloud-Sync-Test (braucht zwei echte Whop-Logins, macht der User selbst)
- Make.com-Webhook-Livetest
- §25a 7%-Satz — juristische Recherche zu Anlage-2-Fällen, keine Coding-Aufgabe
- ~~Consent-Banner Local `app.html`~~ — entfällt mit der Einstellung von Local. Der Prompt in
  `plan/session-prompt-local-consent-banner-2026-08-09.md` ist gegenstandslos.

---

## Was aus dieser Datei noch zu tun ist

**Code-seitig: nichts.** Nach der Einstellung von Local bleibt in dieser Datei kein Punkt übrig,
der durch Programmieren lösbar wäre — Punkt 3 ist eine Nicht-tun-Liste für künftige Audits,
Punkt 4 eine Arbeitsregel, Punkt 5 wartet auf Anwalt, Whop und eigene Live-Tests.

Noch nachzuziehen, sobald `plan/OFFEN.md` nicht mehr von einer anderen Session bearbeitet wird:
die dortigen Local-Bezüge (Abschnitt 1 „Aktuell in Arbeit", 2.2 Consent-Banner, 2.5
Local-Nebenbefunde, 6 `local-sync-*`) auf die Einstellung umstellen.
