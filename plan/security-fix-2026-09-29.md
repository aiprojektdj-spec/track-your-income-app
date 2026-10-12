# Security-Fix Stackr — 2026-09-29

Anlass: Abgleich mit einer 20-Punkte-Security-Checkliste (Instagram-Reel @yatesvids).
Stackr erfüllt die meisten Punkte bereits (Rate Limiting, CORS auf eigene Domain, CSP/HSTS,
keine Secrets im Client oder in der Git-History, CRON_SECRET, Chiffrat-Sync).
Offen sind die folgenden Punkte, nach Priorität sortiert.

---

## 1. KRITISCH — Interne Dateien sind öffentlich abrufbar

Live geprüft auf `https://track-your-income-app.vercel.app` (alle antworten mit HTTP 200):

- `/plan/funde-audit-01-red-team-2026-08-10.md` ← Red-Team-Befunde, Anleitung für Angreifer
- `/plan/funde-audit-04-security-delta-2026-08-10.md`
- `/plan/00-STAND.md` (und damit vermutlich der gesamte `plan/`-Ordner, **auch diese Datei**)
- `/CLAUDE.md`, `/CLOUD-SYNC.md` (Architekturbeschreibung)
- `/build-deploy.py`
- `/test/test-sync-key-storage.js`
- `/ui-lab.html`, `/landing-v2.html` (interne Entwürfe)

**Ursache:** `.vercelignore` schließt nur `compliance/` aus.

### Fix

`.vercelignore` ersetzen durch:

```gitignore
# Nicht in das öffentliche Deployment aufnehmen
compliance/
plan/
graphify-out/
test/
scripts/
kosit-proben/
node_modules/
*.md
build-deploy.py
ui-lab.html
css/ui-lab.css
js/ui-lab.js
```

Hinweis zu `landing-v2.html`: Falls die Seite noch gebraucht wird (verweist auf
`css/landing-v2.css` und `js/landing-v2.js`), sie drinlassen. Sonst diese drei Dateien ebenfalls aufnehmen.
Vorher prüfen, dass keine öffentliche Seite etwas aus `scripts/`, `test/`, `plan/` oder `kosit-proben/` lädt.
Das ist aktuell der Fall: Es gibt keine Referenzen.

### Verifikation nach dem Deploy

```bash
for p in plan/00-STAND.md plan/funde-audit-01-red-team-2026-08-10.md CLAUDE.md CLOUD-SYNC.md build-deploy.py test/test-sync-key-storage.js ui-lab.html; do printf "%-50s %s\n" $p $(curl -s -o /dev/null -w "%{http_code}" https://track-your-income-app.vercel.app/$p); done
```

Erwartet: überall `404`. Zusätzlich müssen `/`, `/app`, `/impressum.html` und `/datenschutz.html` weiter mit `200` antworten.

### Nachsorge

- Die Audit-Dateien waren öffentlich. Deshalb `funde-audit-01` und `funde-audit-04` durchgehen: Ist jeder dort genannte Befund wirklich behoben? Offene Punkte priorisieren.
- Die Vercel-Deployment-Historie enthält die Dateien weiterhin. Alte Preview-Deployments mit öffentlicher URL gegebenenfalls löschen.

---

## 2. MITTEL — Abhängigkeit `undici` mit 4 bekannten Lücken

`npm audit` meldet `undici <= 6.28.0` (moderate: CRLF-Injection, Cookie-Attribute-Injection,
Response-Desync, WebSocket-DoS). Das Paket kommt transitiv über `@vercel/blob`.

### Fix

```bash
npm audit fix
```

```bash
npm install @vercel/blob@^2.8.0
```

Danach sollte `npm audit` `0 vulnerabilities` melden. Anschließend Blob-Upload und Blob-Cleanup kurz testen.

---

## 3. NIEDRIG — `innerHTML` ohne Escaping (XSS-Härtung)

Die CSP (`script-src 'self'`, `script-src-attr 'none'`) blockiert eingeschleustes Inline-JS bereits.
Das ist das Sicherheitsnetz. Als zweite Verteidigungslinie sollten nutzergesteuerte Werte
(Kundennamen, Beschreibungen, Artikelnamen, Notizen, importierte Bank-/CSV-Texte) trotzdem escaped werden.

Stellen mit `innerHTML` ohne `esc()` im selben Ausdruck (Heuristik, viele sind statisches Markup):

| Datei | Treffer |
|---|---|
| js/app.js | 28 |
| js/lager.js | 24 |
| js/whop-auth.js | 9 |
| js/buchungen.js | 7 |
| js/gbr.js | 5 |
| js/statistiken.js, js/ausgaben.js | je 4 |
| js/protokoll.js, js/fahrtenbuch.js, js/euer.js, js/bank-import.js | je 3 |
| js/topnav.js, js/svs.js, js/lohnsteuer.js | je 2 |

### Fix

1. Einen zentralen Helfer anlegen, zum Beispiel in `js/store.js` oder `js/utils.js`, statt der lokalen Kopien in `beleg-ocr-ui.js` und `steuerberater.js`:
   ```js
   function esc(s) {
       if (s == null) return '';
       return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                       .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
   }
   ```
2. Pro Datei jede `${...}`-Interpolation in `innerHTML`-Templates prüfen. Stammt der Wert aus Nutzereingabe, Import oder Sync, wird er in `esc(...)` gewrappt. Zahlen aus `formatCurrency()` und ähnlichen Formatierern sind unkritisch.
3. Priorität: **bank-import.js** (Fremddaten aus CSV), **lager.js**, **buchungen.js**, **app.js**.
4. Test: Einen Kunden oder Artikel mit dem Namen `<img src=x onerror=alert(1)>` anlegen und in allen Listen, Modals und PDFs prüfen, dass er als Text erscheint.

---

## 4. KOSMETISCH — `console.log` im Client-JS

21 Aufrufe in `js/app.js`, `js/backup-crypto.js`, `js/companies.js`, `js/lager.js`, `js/stb-share.js` und `js/store.js`.

### Fix

Entfernen oder auf `console.warn`/`console.error` für echte Fehler umstellen. Besonders in
`backup-crypto.js` und `stb-share.js` prüfen, dass **keine Schlüssel, Passphrasen oder Klartextdaten** geloggt werden.

---

## 5. PROZESS — Prüfung gegen Wiederholung

In den Skill `/security-stackr` einen festen Schritt aufnehmen:
„Nach jedem Deploy: Live-URLs gegen interne Pfade (`plan/`, `*.md`, `test/`, `scripts/`, `build-deploy.py`) prüfen, erwartet ist 404.“

---

## Checkliste

- [x] `.vercelignore` erweitert (67fc5c5) — **Push offen**: `git push` scheiterte mit 403, Git-Credential gehört zu `secondlifevintage07-coder` statt `aiprojektdj-spec`
- [ ] Verifikation: interne Pfade liefern 404, öffentliche Seiten 200 — erst nach dem Push
- [x] Red-Team-/Security-Audit-Befunde gegen den Code geprüft: R2/R3/R4/R6/R7/R8/R10 und S1–S6 sind im Code belegt. Offen nur bewusst: R1 (Design), R5 (Produktentscheidung), R9 (kein Fix nötig), **R7-Fallback ab 2026-12-01 entfernen** (`AAD_FALLBACK_UNTIL` in js/cloud-sync.js). R3: prüfen, dass `SYNC_OWNER_IDS` in Vercel gesetzt ist
- [x] `npm audit fix` → undici 6.29.0, 0 vulnerabilities (67fc5c5). `@vercel/blob`-Bump nicht nötig, alle api/-Module laden; Live-Upload-Test offen
- [x] `Utils.escapeHtml` (js/utils.js) ist der zentrale Helfer; Scan aller Templates, letzte Lücken in lager/app/protokoll/bank-import gefixt (e85fda6). bank-import und buchungen waren bereits escaped
- [ ] XSS-Test mit `<img src=x onerror=alert(1)>` im Browser — braucht Login, nur gegen Produktion
- [x] `console.log` bereinigt (f6bbb77), keine Schlüssel/Klartexte geloggt
- [x] `/security-stackr` um Kategorie 15 (Live-URL-Check) ergänzt
