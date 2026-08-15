# Stackr Web 1.7

Buchhaltung für Selbstständige. Vanilla JS, **kein Build-Schritt**, statisches Hosting auf Vercel
plus 5 Serverless-Endpunkte in `api/`. Auth und Zahlung über **Whop**. Buchhaltungsdaten liegen
local-first im Browser; Cloud-Sync speichert ausschließlich Chiffrat.

Antworten, Code-Kommentare und Commit-Messages auf **Deutsch**.

## Erste Amtshandlung jeder Session

```bash
git status --short && git log --oneline -8
```

An diesem Repo arbeiten **mehrere Sessions gleichzeitig im selben Working Tree** — das ist der
Normalfall, nicht die Ausnahme. Eine Datei, die in `git status` auftaucht, hält gerade jemand
anders: nicht anfassen, per `send_message` abstimmen.

## Nicht verhandelbar

1. **Pfad-gescoped committen — beim `add` *und* beim `commit`:**
   `git commit -F <nachricht> -- <datei>`. Nie `git add -A`, `git add .`, `git commit -a`, und
   nie ein `git commit` ohne Pathspec: das committet den **gesamten Index**, auch was eine
   andere Session in den Sekunden dazwischen hineingelegt hat. Ist am 2026-08-12 zweimal und
   am 2026-08-15 erneut passiert.
2. **`git status` unmittelbar vor dem Commit erneut prüfen**, nicht nur beim Sessionstart.
3. **Stand immer gegen den Code prüfen, nie gegen Plandateien** — auch nicht gegen die in
   `plan/`. Die veralten binnen Stunden, nachweislich sogar am Tag ihrer Entstehung.
4. **Nie über eine PowerShell-Textpipeline schreiben** (`Set-Content`, `Out-File`) — das
   zerschießt die Umlaute. Repo ist UTF-8 ohne BOM: Edit/Write oder Python mit
   `encoding='utf-8', newline=''`. Commit-Messages dagegen **ohne Umlaute** (ae/oe/ue/ss),
   so wie das bisherige Log.
5. **Kein Dev-Bypass fürs Whop-Gate.** Braucht ein Test einen echten Login, meldet sich der User
   einmal im Browser-Pane an; die Session bleibt danach erhalten. Claude loggt sich nicht selbst
   ein.
6. **Keine neue Abhängigkeit ohne Rückfrage** — es gibt genau eine produktive (`@vercel/blob`).
   Insbesondere **kein `npm install xlsx`**: das holt gezielt die verwundbare 0.18.5 zurück
   (CVE-2023-30533, CVE-2024-22363). SheetJS kommt nur von `cdn.sheetjs.com` und liegt als
   0.20.3 in `js/vendor/` mit SHA-256 in `js/vendor/VERSIONS.md`.
7. **Gesetzeswerte gehören in eine Jahresfunktion**, nie in eine jahresfeste Konstante — auch
   wenn heute nur ein Wert existiert. Muster: `App._getUstGrenzen(year)` in
   [js/app.js:1061](js/app.js:1061).
8. **CSP steht in `vercel.json` pro Route, nie global** — Browser schneiden mehrere
   CSP-Header, ein globaler würde die spezifischen aushebeln.

## Verifikation

- **Browser-Test nur auf einem frischen Port.** `python -m http.server` schickt keine
  No-Cache-Header, und der Cache hängt am Origin: Reload, Cache-Bust-Query und neuer Tab liefern
  trotzdem alten Code. Neuen Eintrag in `.claude/launch.json` anlegen, Port = höchster
  vorhandener + 1.
- **Rechenlogik über `test/`** — 32 Node-Harnesses, cache-immun, gute Vorlage für neue Tests:
  ```bash
  for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
  ```

## Wo was steht

| Datei | Inhalt |
|---|---|
| [`plan/00-STAND.md`](plan/00-STAND.md) | Einstieg, Gesamtbild, Vollaudit-Übersicht |
| [`plan/01-AUFGABEN.md`](plan/01-AUFGABEN.md) | Was noch offen ist — **vor dem Greifen gegen den Code prüfen** |
| [`plan/02-ENTSCHEIDUNGEN.md`](plan/02-ENTSCHEIDUNGEN.md) | Was bewusst **nicht** geändert wird. Vor jedem Audit lesen |
| [`plan/03-ARBEITSREGELN.md`](plan/03-ARBEITSREGELN.md) | Ausführliche Fassung dieser Regeln, mit den Vorfällen dahinter |
