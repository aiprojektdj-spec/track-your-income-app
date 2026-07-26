# Voller Rechts-/Compliance-Audit — Runde 2

Stand: 2026-07-25. Fortsetzung von Runde 1 (Kern-Rechtstexte + AVV-Klärung, siehe
`plan/whop-dpa-anfrage.md`). Diese Runde: Cross-Page-Konsistenz, GoBD-Doku-Aktualität gegen
den aktuellen WIP-Code, plus fokussierter `/datenschutz`- und `/security-stackr`-Durchlauf auf
der von zwei Explore-Agenten kartierten Datei-Fläche. Reine Diagnose, keine Fixes angewendet.

---

## A. GoBD-Doku-Drift — Cloud-Anker-Feature (uncommitted)

**Befund:** Der WIP-Code (`js/store.js`, `js/cloud-sync.js`, `js/protokoll.js`, `api/sync.js`)
fügt einen neuen **"Cloud-Anker"-Mechanismus** hinzu:

- `Store._auditContentHash()` bildet einen stabilen SHA-256-Inhaltshash je Audit-Log-Eintrag.
- `CloudSync._pushAuditAnchors()` meldet neue Einträge (nur `{id, hash}`, keine Klardaten)
  nach jedem Sync an `api/sync.js` (`action: 'anchor'`), die sie **append-only** in einer
  Redis-Liste ablegt (RPUSH + LTRIM auf 20.000 Einträge, `action: 'anchor_pull'` zum Lesen).
- `Protokoll`-UI (`auditVerifyBtn`) ruft zusätzlich zur lokalen Hash-Ketten-Prüfung
  `CloudSync.verifyAuditAnchors()` auf und meldet Abweichungen als Manipulationsverdacht.
- Ein Code-Kommentar benennt die eigentliche Motivation präzise: die rein lokale Hash-Kette
  kann von einem Angreifer mit Kenntnis der Formel **in sich konsistent neu berechnet**
  werden — der externe, serverseitig einmal geschriebene Anker verhindert genau das
  rückwirkend, weil ein späteres Abweichen zwischen Client-Hash und Server-Anker auffällt.
- Art. 17 DSGVO sauber mitgezogen: `action: 'delete'` löscht jetzt auch `anchorKey`.
- StB-Readonly-Modus (`body.owner`) ist bei beiden neuen Actions korrekt blockiert (403),
  konsistent mit dem bestehenden Steuerberater-Zugriffsmodell.

✅ Technisch sauber umgesetzt — Datensparsamkeit (nur Hash+ID+Timestamp), Art.-17-Löschung,
StB-Readonly-Konsistenz, bestehende Rate-Limits (`api/sync.js` IP- + User-Rate-Limit greifen
auch für `anchor`/`anchor_pull`, da im selben Handler nach denselben Checks) alle korrekt.

❌ **Lücke:** `verfahrensdokumentation.html` Abschnitt 4 ("Nachvollziehbarkeit —
Änderungsprotokoll") beschreibt nur die lokale Hash-Kette, nicht den neuen externen Anker.
Sobald dieser WIP-Code committet/live ist, ist die Verfahrensdoku an dieser Stelle unvollständig
— relevant, weil das Dokument explizit als Nachweis gegenüber Finanzamt/Betriebsprüfung gedacht
ist (GoBD Rz. 64, Unveränderbarkeit).
→ Fix (nicht ausgeführt, nur benannt): Abschnitt 4 um 2-3 Sätze zum Cloud-Anker ergänzen —
dass bei aktivem Cloud-Sync zusätzlich ein externer, vom Client nicht rückwirkend
veränderbarer Hash-Referenzpunkt existiert, der die Aussagekraft der Hash-Kette verstärkt.
**Priorität: BALD** (erst relevant sobald der WIP-Stand committet wird — vorher kein
Doku-Update nötig, sonst dokumentiert man Code der noch nicht live ist).

🟡 **Zu bewerten (nicht kritisch):** `ANCHOR_MAX = 20000` (LTRIM-Deckel) — bei sehr aktiven,
langjährigen Firmen könnten die ältesten Anker nach Jahren aus der Liste fallen, während die
§147-AO-Aufbewahrungsfrist 10 Jahre verlangt. Für die allermeisten Solo-/Kleinunternehmer-Konten
weit ausreichend; nur als Skalierungs-Randnotiz vermerkt, kein aktueller Fix nötig.
**Priorität: NICE**

---

## B. Cross-Page-Konsistenz (Preis/Trial/Whop-Rolle)

**Preis (15€/Monat, 135€/Jahr):** In `index.html`, `landing-v2.html`, `agb.html`, `js/i18n.js`,
`js/landing.js` überall derselbe Betrag, nur unterschiedlich formatiert (z. B. "15 €" vs.
"15,00 €"). **Keine echte Inkonsistenz**, reine Marketing-Formatierungs-Varianz.
Priorität: NICE (rein kosmetisch, keine Rechtsfrage)

**Trial-Bedingungen:** Marketing-Seiten (`index.html`, `landing-v2.html`) beschreiben den Trial
stark verkürzt ("Karte hinterlegen, keine Abbuchung"), während `agb.html` §4 und `refund.html`
§1/§3 die vollständige rechtliche Fassung tragen (Einmaligkeit pro Account,
Missbrauchsklausel, Widerruf-Interaktion). Das ist **normale und zulässige Verkürzung** auf
Marketing-Ebene — die eigentliche Kaufentscheidung fällt im Whop-Checkout, nicht auf der
Landing-Page, und die AGB sind von dort verlinkt. Kein Verstoß gegen §5 UWG, solange der
Whop-Checkout selbst (außerhalb dieses Repos, nicht prüfbar) vor der Zahlungspflicht auf die
vollständigen Bedingungen hinweist bzw. verlinkt — das solltest du einmal manuell im
Whop-Checkout-Flow gegenchecken, da ich das nicht einsehen kann.
Priorität: NICE (mit einem manuellen Whop-Checkout-Spotcheck als einzigem offenen Punkt)

**"Merchant of Record"-Begriff:** Nur in `agb.html`/`datenschutz.html` verwendet, auf
Marketing-Seiten nicht — dort nur "Zahlung sicher über Whop". Kein Compliance-Problem: der
MoR-Status ist eine vertragliche/datenschutzrechtliche Einordnung, die in die Rechtstexte
gehört, nicht in Marketing-Copy.
Priorität: erfüllt, keine Aktion nötig

**`agb.html#empfehlungsprogramm`-Anker:** verifiziert gültig (§11-Abschnitt existiert weiterhin
mit dieser ID).

---

## C. `/datenschutz`-Skill — fokussierter Durchlauf

### 1. Cookies/localStorage-Deklaration vs. Realität
Art. 13 DSGVO | ⚠️ Lücke
**Befund:** `cookies.html` behauptet wörtlich: *"Alle eingesetzten Technologien sind im
Folgenden vollständig aufgelistet"* und listet u. a. `stackr_*`, `stackr_settings`,
`stackr_plan` als Schlüssel-Präfix. Tatsächlich im Code verwendete Keys (Stichprobe aus
`rechnungen/js/app.js`, `eigenbelege/js/app.js`) sind u. a.: `oyi_active_company`,
`purchases`, `_oyi_lsmirror`, `_oyi_lsmirror_ts`, `agb_accepted`, `app_theme`,
`eb_sidebar_collapsed` — **kein einziger davon beginnt mit `stackr_`**, und mehrere
(`agb_accepted`, `app_theme`, `eb_sidebar_collapsed`, `_oyi_lsmirror`) tauchen in der
Cookie-Tabelle **gar nicht** auf.
**Bewertung:** Keine der ungenannten Daten ist sensibel (Theme-Präferenz, Sidebar-Zustand,
AGB-Zustimmungs-Timestamp, technischer Merge-Spiegel) — datenschutzrechtlich also kein
Verstoß in der Sache. Das Problem ist die **Vollständigkeits-Behauptung selbst**: sie ist
faktisch unzutreffend, was bei einer Prüfung (Aufsichtsbehörde, Abmahnung) als formaler Mangel
auffallen kann.
Empfehlung: Entweder Satz "vollständig aufgelistet" zu "beispielhaft, die wichtigsten
Kategorien" abschwächen, oder die Tabelle um die realen Keys ergänzen (kein `stackr_`-Präfix
im Code — der Text sollte das tatsächliche Namensschema nennen oder generisch von
"technischen Einstellungs-Keys" sprechen statt konkrete falsche Präfixe zu behaupten).
**Priorität: BALD**

### 2. Whop-Verantwortlichkeits-Status
Art. 28 DSGVO | ✅ inhaltlich plausibel, ⚠️ noch unbestätigt
Deckt sich mit Runde 1: `datenschutz.html` ordnet Whop korrekt als eigenständig
Verantwortlichen ein (kein AVV einschlägig); Bestätigungsanfrage an Whop ist in
`plan/whop-dpa-anfrage.md` vorbereitet, Versand steht noch aus. Kein neuer Befund, nur
Referenz für Vollständigkeit dieses Reports.

### 3. Upstash/Vercel-AVV
Art. 28 DSGVO | ✅ Standard-DPA extern bestätigt vorhanden
Aus Runde-1-Recherche bestätigt: Upstash (`upstash.com/trust/dpa.pdf`) und Vercel
(`vercel.com/legal/dpa`) bieten beide offizielle, GDPR/SCC/DPF-konforme Standard-DPAs.
Offen bleibt nur (außerhalb Code-Prüfbarkeit): ob euer konkreter Account-Plan das DPA
automatisch einschließt (Vercel-PDF deutete eine Pro/Enterprise-Bindung an) — das kannst nur
du im jeweiligen Dashboard verifizieren.
**Priorität: BALD**

### 4. Recht auf Löschung (Art. 17)
✅ Konform — `action: 'delete'` in `api/sync.js` löscht sowohl den Haupt-Snapshot als auch
(neu, Teil des WIP) die Anker-Liste. Bestätigt implementiert.

### 5. SRI-Lücke `ui-lab.html`
Art. 32 DSGVO / Supply-Chain | 🟢 Niedrig
`ui-lab.html:9` lädt `@tabler/icons-webfont` von jsDelivr **ohne** `integrity`-Attribut
(anders als `app.html`, `rechnungen/index.html`, `eigenbelege/index.html`, `lager/index.html`,
die SRI korrekt setzen). Da es sich um ein CSS-Stylesheet (kein Skript) handelt, ist das
Ausnutzungsrisiko gering (kein direkter Code-Execution-Pfad über CSS), aber bei
CDN-Kompromittierung theoretisch für Daten-Exfiltration über CSS-Selektoren nutzbar.
ui-lab.html ist laut Projekt-Kontext ein internes Design-Prototyp-Tool, keine Nutzer-Seite.
Empfehlung: SRI-Hash ergänzen (gleiches Muster wie in den anderen Dateien), 5-Minuten-Fix.
**Priorität: NICE**

### 6. Impressum, sonstige Datenschutz-Grundlagen
✅ Keine neuen Befunde ggü. Runde 1 (vollständig geprüft, siehe letzter Report).

---

## D. `/security-stackr`-Skill — fokussierter Durchlauf

### 1. CSP — Meta-Tag vs. HTTP-Header
🟡 MITTEL (Defense-in-Depth, kein akuter Exploit-Pfad)
`vercel.json` setzt zentrale Security-Header (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
HSTS, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`) — aber **keine
Content-Security-Policy** als HTTP-Header. CSP existiert ausschließlich als `<meta>`-Tag in
12 einzelnen HTML-Dateien. Das bedeutet: CSP greift erst nach dem Parsen des `<head>`, und
Directives wie `frame-ancestors`/`sandbox`/`report-uri` funktionieren über `<meta>` gar nicht
(werden vom Browser ignoriert). Praktisch abgefedert, weil `X-Frame-Options: DENY` bereits
Clickjacking global per Header abdeckt — der fehlende `frame-ancestors` in der Meta-CSP ist
also **nicht** die Lücke, die sie in anderen Setups wäre.
Empfehlung: `Content-Security-Policy` zusätzlich zentral in `vercel.json` setzen (gleicher
Wert wie in den Meta-Tags, ggf. striktester gemeinsamer Nenner), Meta-Tags können als
Fallback bleiben.
**Priorität: NICE** (robusteres Setup, kein akutes Loch)

### 2. `connect-src`-Unterschied `app.html` vs. `index.html`
✅ Kein Finding — korrekt spezifisch statt zu weit
`app.html` erlaubt `connect-src` zusätzlich `api.whop.com`, `*.public.blob.vercel-storage.com`,
`*.make.com` (weil die eigentliche App dorthin verbindet: Whop-API, Blob-Attachments,
Make.com-Webhooks — letzteres bewusst clientseitig, siehe `makecom-webhooks`-Memory).
`index.html` (Marketing-Landing) beschränkt auf `'self'`, weil dort keine dieser Verbindungen
gebraucht wird. Das ist **enger, nicht loser** als nötig pro Seite — vorbildlich, kein Fix.

### 3. Secrets & Server-Endpunkte
✅ Kein Finding — `WHOP_API_KEY`, `UPSTASH_REDIS_REST_TOKEN` etc. ausschließlich über
`process.env` in `api/sync.js`, keine hartcodierten Werte, keine Client-seitige Exposition
(`js/whop-auth.js` referenziert `WHOP_API_KEY` nur in einem Kommentar, nicht als Wert).

### 4. Cloud-Sync-Zugriffskontrolle
✅ Kein Finding — Whop-Token wird serverseitig gegen `https://api.whop.com/api/v2/me/has_access/`
verifiziert (`api/sync.js:50`), CORS ist auf die eigene Domain beschränkt
(`Access-Control-Allow-Origin: https://track-your-income-app.vercel.app`, nicht `*`), IP- und
User-Rate-Limiting vorhanden (429 bei Überschreitung) und gilt auch für die neuen
`anchor`/`anchor_pull`-Actions, da sie denselben Handler-Pfad nach denselben Checks durchlaufen.
Neue Anchor-Endpunkte validieren Eingaben strikt per Regex (`ID_RE`, `HASH_RE`), lehnen
Batches >1000 ab, StB-Readonly (`body.owner`) korrekt mit 403 blockiert.

### 5. Übrige 10 Kategorien der Skill-Checkliste
Nicht erneut vollständig durchlaufen — decken sich mit dem bereits in Runde 1 bzw. in früheren
Security-Audits (Memory: CSP-Härtung, Whop-Access-Gate-Fix) geprüften und bestätigten Stand.
Kein Hinweis auf neue Regressionen in den hier untersuchten WIP-Dateien.

---

## Zusammenfassung — Priorisierte Liste

| Prio | Thema | Nächster Schritt |
|---|---|---|
| 🟡 BALD | Verfahrensdoku fehlt Cloud-Anker-Beschreibung | ✅ erledigt 2026-07-26 — WIP committet (`f5c88d8`), §4 präzisiert + Änderungshistorie fortgeschrieben |
| 🟡 BALD | `cookies.html` "vollständig aufgelistet"-Behauptung stimmt nicht mit realen Key-Namen überein | ✅ erledigt 2026-07-26 (`0733e77`) — Tabelle auf 9 Kategoriezeilen umgebaut, deckt alle 32 realen Keys ab; Vollständigkeitszusage gilt jetzt den Kategorien |
| 🟡 BALD | Upstash/Vercel-DPA-Geltung für euren Plan unverifiziert | Selbst im Dashboard prüfen (aus Runde 1, hier bestätigt weiter offen) |
| 🔴 NEU | Vercel Blob nirgends als Empfänger genannt, "ausschließlich Upstash (Frankfurt, EU)" ist falsch | Offen — eigener Session-Prompt: `plan/session-prompt-vercel-blob-empfaenger.md`. Braucht vorab die Blob-Region aus der Vercel-Konsole |
| 🟢 NICE | CSP nur als Meta-Tag, nicht als HTTP-Header | ✅ erledigt 2026-07-26 (`f687a51`) — 14 routenspezifische Einträge in `vercel.json`, statisch + im Browser gegengeprüft |
| 🟢 NICE | `ui-lab.html` fehlt SRI-Hash auf CSS-Import | ✅ erledigt 2026-07-26 (`7364ba4`) |
| 🟢 NICE | Whop-Checkout-Flow selbst nicht einsehbar | Einmal manuell prüfen ob volle AGB/Trial-Bedingungen vor Zahlungspflicht sichtbar sind |
| 🟢 NICE | `ANCHOR_MAX`-Skalierungsgrenze bei sehr langjährigen Firmen | Nur beobachten, kein aktueller Fix |
| 🟢 NICE | `cookies.html` — 5 Kleinfunde (Stand-Datum, §25-Zitat, Abschnitt 5 rät Cookies statt Website-Daten zu löschen, jsDelivr-Wording, IndexedDB) | Offen — mit im Session-Prompt `plan/session-prompt-vercel-blob-empfaenger.md` |

**Gesamtbild Runde 2:** Keine 🔴 kritischen oder ❌ akuten Verstöße gefunden. Der neue
Cloud-Anker-Code ist technisch sauber (Datensparsamkeit, Art.-17-Löschung, Rate-Limits,
StB-Readonly alle korrekt mitgezogen) — die einzige Lücke ist, dass die Verfahrensdoku ihm
noch hinterherhinkt, was aber erst mit dem Commit akut wird. Der zweite Realbefund
(Cookie-Tabelle vs. tatsächliche Storage-Keys) ist eine Textungenauigkeit, keine
Datenschutzverletzung in der Sache. Security-seitig bestätigt dieser Durchlauf ausschließlich
bereits vorhandene gute Praxis, keine neuen Lücken.

---

## Nachtrag 2026-07-26 — Umsetzungssession

Punkte 1, 2, CSP und SRI sind abgearbeitet (siehe Statusspalte oben). Beim Umsetzen sind drei
Dinge aufgefallen, die im Audit-Durchlauf selbst nicht sichtbar waren:

**🔴 Vercel Blob als ungenannter Empfänger.** Der `legal-reviewer` fand beim Gegenlesen von
`cookies.html`, dass die Zusage „ausschließlich … bei Upstash (Frankfurt, EU)" nicht stimmt —
großes Ledger und Anhänge gehen zusätzlich an Vercel Blob, das in `cookies.html`,
`datenschutz.html` und `verfahrensdokumentation.html` nirgends als Empfänger auftaucht
(Art. 13 Abs. 1 lit. e DSGVO). Das wiegt schwerer als der ursprüngliche Anlass des Audits.
Eigener Session-Prompt, weil die Blob-Region erst aus der Vercel-Konsole geklärt werden muss.

**🟡 Cloud-Sync lief auf drei Unterseiten gar nicht.** `lager/`, `rechnungen/` und
`eigenbelege/` luden `whop-auth.js` und `stb-share.js`, aber nicht `cloud-sync.js` — obwohl
`whop-auth.js:329` `CloudSync.init()` aufruft und `stb-share.js:158` ohne `CloudSync` aussteigt.
Wer länger im Rechnungs- oder Lagermodul arbeitete, synchronisierte bis zum Wechsel nach
`app.html` nichts, und die Steuerberater-Freigabe war von dort nicht bedienbar. Gefixt in
`503497d` — inklusive `blob-attachments.js`, ohne die der Sync dort mit einem ReferenceError
abgebrochen wäre (`cloud-sync.js` ruft `BlobAttachments.*` in `_syncScope` ungeschützt auf).

**🟢 Beobachtung im Anker-Code, nicht gefixt.** `_pushAuditAnchors()` in `js/cloud-sync.js`
schreibt die Merkliste bereits gemeldeter IDs (`_saveAnchored`) erst nach der kompletten
Batch-Schleife. Bricht ein Batch mit != 200 ab (z. B. Rate-Limit — 40 Req/min, und die
Erstverankerung eines großen Logs braucht viele Batches), gehen die erfolgreichen Batches
desselben Laufs aus der Merkliste verloren und werden beim nächsten Sync erneut gesendet.
Fachlich harmlos (der Server dedupliziert über identische Hashes, `verifyAuditAnchors()`
wertet `uniq.length === 1` weiterhin als OK), kostet aber unnötig Requests und bläht die
Redis-Liste. Fix wäre `_saveAnchored` vor das `return` zu ziehen. Bewusst nicht in den
Commit gezogen, um fremden WIP unverändert zu übernehmen.
