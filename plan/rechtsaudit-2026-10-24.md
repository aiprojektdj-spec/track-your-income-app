# Rechts-Audit 2026-10-24 — Rechtstexte vs. tatsächliche Datenflüsse

Anlass: Entscheidung 2026-10-21 „Server führt, Daten lesbar“ (Supabase, Shopify-OAuth).
Geprüft gegen den Code auf `master` (`b013830`) und **live gegen Supabase `stackr-prod`**
(`usrhhjwvoefjdgrwovkg`) per Connector, nur lesend. **Keine Rechtsberatung** — Freigabe der
Formulierungen durch den Anwalt. Rechtstexte wurden **nicht** geändert.

Nicht neu auditiert (liegt beim Anwalt, `plan/session-prompt-nachrichten-rechtliches-2026-10-18.md`):
AGB §11, Trial-/§356a-Klausel, Preisangabe §19 UStG, §14c.

## 0. Ist-Stand in Produktion (gemessen heute)

| Prüfung | Ergebnis | Quelle |
|---|---|---|
| Region Supabase-Projekt | `eu-central-1` (Frankfurt), Name `stackr-prod` | Supabase `get_project` |
| Supabase bekommt Live-Schreibungen | **ja**: `sync_snapshots` 8 Zeilen, letzte Änderung **heute 11:54 UTC**; `whop_sessions` 34 (verschlüsselt, läuft bis 23.11.); `sync_anchors` 3 471; `public_keys` 13; `ops_alerts` 2 | `pg_stat_user_tables`, `max(updated_at)` |
| Supabase primär oder Spiegel? | **Spiegel** (`rate_limits` = 0, Rate-Limits laufen nur gegen das Primärsystem → primär weiter Upstash). Passt zu `STORAGE_MIRROR=supabase` seit 14.10. laut Memory | `api/_sync-store.js:10`, `:21` |
| Anhänge | Bucket `attachments` leer → Belege weiter bei **Vercel Blob** (`BLOB_BACKEND` nicht `supabase`) | `storage.objects` |
| Klartext-Datenmodell (R2: `records`, `companies` …) | **nicht** in Prod | Tabellenliste |
| Shopify-Tabellen (`integrations`, `shopify_eingang`) | **nicht** in Prod; Endpunkte live, aber ohne ENV/Tabellen fail-closed | Tabellenliste, `api/shopify-webhook.js:52` |
| Kündigungstabelle `kuendigungen` | **fehlt in Prod**, obwohl `api/kuendigung.js` (b013830) auf `origin/master` liegt | Tabellenliste |
| Externe KI-Dienste | keine (grep `openai|anthropic|gemini|mistral|huggingface` über `js/ api/ *.html`: 0) | — |

**Folgerung:** Der Klartext-Umzug ist **nicht** live → die E2E-Aussagen sind **heute noch wahr**
(Supabase sieht nur Chiffrat). Falsch ist heute schon, dass **Supabase als Empfänger fehlt**
(seit ca. 14.10., Phase „Ü1“ des Entwurfs). Diese Funde sind **P0-sofort**. Alle E2E-Aussagen
werden mit R-Livegang bzw. dem ersten echten Shopify-Shop falsch → **P0-vor-Livegang**.

Annahme: `STORAGE_BACKEND` ist nicht `supabase` (nur indirekt gemessen über `rate_limits`=0).
Für die Texte egal — in beiden Fällen liegt dasselbe Chiffrat bei Upstash **und** Supabase.

---

## P0-sofort — heute schon falsch

### A1 Supabase fehlt als Speicherort des Cloud-Sync

| Datei:Zeile | Text sagt | Code/Prod macht |
|---|---|---|
| `datenschutz.html:244-248` (4.1 „Wo gespeichert wird“) | Chiffrat „bei Upstash“ | Chiffrat bei Upstash **und** Supabase (Spiegel, `api/_sync-store.js:9-12`) |
| `datenschutz.html:283-287` (4.3 StB-Freigabe) | Public Key + Grant „bei Upstash“ | auch in Supabase (`public_keys` 13 Zeilen, `grants`) |
| `datenschutz.html:402-423` (6.1 Anker) | Anker ohne Ort | `sync_anchors` (3 471) liegt auch bei Supabase → Ort nennen |
| `datenschutz.html:435-447` (7 AVV) | nur Upstash + Vercel | Supabase fehlt als Auftragsverarbeiter |
| `cookies.html:192` | „Chiffrat bei Upstash (Frankfurt, EU)“ | + Supabase |
| `js/cloud-sync.js:1148` (Opt-in-Dialog — Grundlage der Einwilligung!) | „Auftragsverarbeiter Upstash … Vercel Blob“ | + Supabase |
| `verfahrensdokumentation.html:45-46` | „Vercel Serverless + Upstash Redis“ | + Supabase; Änderungshistorie (Abschnitt 9) ohne Eintrag zum Umschalten |

**Vorschlag** — Entwurf `plan/rechtstexte-supabase-entwurf.md` 1.1/1.4/1.5/1.10/1.11 in der
Variante **Ü1** (Sync gespiegelt, Belege weiter Vercel Blob) ist gegen den Code weiter korrekt
und kann so übernommen werden, mit zwei Korrekturen:

- 1.1 Ü1: ohne den Halbsatz zu signierten Links/IP an Supabase (Bucket ist leer, F5).
- 1.4: Transfergrundlage **je Anbieter** statt „beide DPF“ (siehe A2).

Ü1-Text für 4.1 (konsolidiert):
> **Wo gespeichert wird:** Die verschlüsselten Daten werden in der Region Frankfurt am Main
> (EU, eu-central-1) gespeichert. Wir ziehen den Speicher derzeit von Upstash (Upstash, Inc.) zu
> Supabase (Supabase, Inc.) um; während des Umzugs liegt dasselbe Chiffrat bei beiden Anbietern,
> jeweils in Frankfurt. Nach Abschluss des Umzugs werden die Daten bei Upstash gelöscht.
> Verschlüsselte Belege und Anhänge liegen bei Vercel Blob (Vercel Inc.) in Frankfurt. […Rest
> unverändert: Transport über Vercel-Serverless, getstackr.de / track-your-income-app.vercel.app]

Opt-in-Dialog `js/cloud-sync.js:1148` (Ü1):
> `'Aufbewahrung bei unseren Auftragsverarbeitern <strong>Upstash und Supabase (Frankfurt, EU)</strong>, große Anhänge wie Belegfotos bei <strong>Vercel Blob</strong>.'`

### A2 Drittlandtransfer: Supabase hat kein DPF

`datenschutz.html:443-445`: „beide sind unter dem EU-US Data Privacy Framework zertifiziert“.
Für Supabase falsch (Suche 07.10. ohne Treffer, DPA nennt nur SCC Modul 2/3,
`plan/tia-supabase-2026-10-07.md`). Vorschlag für Ziffer 7:
> Vercel Inc. und Upstash, Inc. sind unter dem EU-US Data Privacy Framework zertifiziert
> (Art. 45 DSGVO), hilfsweise gelten Standardvertragsklauseln. Für Supabase, Inc. stützen wir
> eine mögliche Übermittlung auf die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
> Die Daten liegen in einem Rechenzentrum von Amazon Web Services in Frankfurt; weitere
> Unterauftragsverarbeiter nennt Supabase unter supabase.com/legal/subprocessors.

TIA Supabase liegt nur als Plan-Entwurf. → nach `compliance/` übernehmen (dort gitignored) und
**Whop-Sitzungen** ergänzen: `whop_sessions` enthält Whop-Zugangs-/Erneuerungstoken, in Supabase
AES-256-GCM-verschlüsselt mit `WHOP_SESSION_KEY` (`api/_whop-sessions.js:25-31`) — Schlüssel liegt
bei Vercel, nicht bei Supabase; Bewertung „nur Chiffrat“ trägt damit weiter.

### A3 Login-Sitzung: Supabase fehlt

`datenschutz.html:342-348` (Ziffer 5): Sitzung + Token „bei Upstash“. Prod: 34 Sitzungen auch in
Supabase (Spiegel, verschlüsselt). Vorschlag:
> … serverseitig bei Upstash (Upstash, Inc.) und — verschlüsselt — bei Supabase (Supabase, Inc.),
> jeweils in Frankfurt am Main (EU), ab. Der Eintrag verfällt automatisch 30 Tage nach der letzten
> Erneuerung. […Zählersatz unverändert, Zähler laufen weiter nur bei Upstash]

### A4 Kündigung: Nachweis wird nicht gespeichert, Text sagt das Gegenteil

`datenschutz.html:356-357`: „Wir speichern sie bei Supabase … als Nachweis“. Die Tabelle
`kuendigungen` (`supabase/migrations/20261024000001_kuendigungen.sql`) ist in Prod **nicht**
angelegt → `_speichern()` schlägt still fehl (`api/kuendigung.js`, gibt `null` zurück), Nachweis
existiert nur in der Make-Mail. Kein Text-, sondern ein Betriebsfund mit Rechtsfolge
(§ 312k Abs. 3/4 BGB, Beweislast für den Eingang).
**Fix:** Migration in Prod einspielen (User), danach eine Testkündigung mit Testadresse.
Text dann richtig.

### A5 Informationspflicht beim Anbieterwechsel nicht erfüllt

Entwurf F10 (User 07.10.: „ja, aktiv informieren“): In-App-Hinweis + Whop-Mail **zu Ü1**.
grep `Neuer Speicherort` in `js/`: 0 Treffer → nicht gebaut, obwohl Ü1 seit ~14.10. läuft.
DSE Ziffer 9 verspricht E-Mail bei wesentlichen Änderungen. Hinweistext liegt im Entwurf F10.

---

## P0-vor-Livegang — wird mit R-Phase / erstem echten Shopify-Shop falsch

### B1 Liste aller E2E-/Local-First-Aussagen, die dann falsch sind

| Datei:Zeile | Aussage |
|---|---|
| `datenschutz.html:33` | „…an uns übertragen“ (Kurzfassung oben: Daten bleiben lokal) |
| `datenschutz.html:81-83` | Buchhaltungsdaten verlassen Gerät nur verschlüsselt |
| `datenschutz.html:108-113` | standardmäßig nur lokal; „ausschließlich E2E-verschlüsselt“ |
| `datenschutz.html:116-121` | Kundendaten der Nutzer nur lokal/E2E; Stackr „nur technisches Werkzeug“ |
| `datenschutz.html:185-188` | IndexedDB-Daten verlassen Browser nicht |
| `datenschutz.html:214-222` | „Stackr ist eine Local-First-Anwendung“; Sicherung Sache des Nutzers |
| `datenschutz.html:225-263` | 4.1 komplett (E2E, Schlüssel nie hochgeladen, Wiederherstellungscode) |
| `datenschutz.html:272` | „Anders als beim Cloud-Sync … unverschlüsselt“ |
| `datenschutz.html:402` | „verschlüsselten Cloud-Stand“ |
| `datenschutz.html:431-432`, `446-447` | keine AV ohne Sync; Risiko minimiert, weil Chiffrat |
| `datenschutz.html:468-470` | Buchhaltungsdaten „auf Anfrage“ löschen — Server-Aufbewahrung fehlt |
| `agb.html:219-228` | §7: lokal, E2E, Schlüssel allein beim Nutzer |
| `agb.html:231-233` | nach Kündigung „verbleiben lokal“ — Serverdaten ungeregelt |
| `cookies.html:188-193`, `269-270` | IndexedDB verlässt Gerät nicht; Chiffrat |
| `verfahrensdokumentation.html:45-46`, `125-127` | E2E, Server kann nicht einsehen |
| `index.html:178-179`, `213`, `273`; `landing-v2.html:87`, `104` | Werbung „Ende-zu-Ende-verschlüsselt“ — ab dann irreführend (§ 5 UWG) |
| `compliance/verzeichnis-verarbeitungstaetigkeiten.md:16`, `:58-60`, `:66` | VT-4 „keine Verarbeitung durch den Anbieter“ |
| `compliance/gobd-verfahrensdokumentation.md:14-16`, `:31`, `:36` | „Server-Speicherung: keine“ |

### B2 Neuer Text Ziffer 2.3/4 (Endstand, Vorschlag)

> **2.3 Buchhaltungsdaten.** Deine Buchhaltungsdaten (Einnahmen, Ausgaben, Rechnungen, Belege,
> Lager, Protokoll) speichern wir auf unseren Servern bei Supabase (Supabase, Inc.) in Frankfurt
> am Main (EU), damit du von mehreren Geräten darauf zugreifen, Integrationen nutzen und deinem
> Steuerberater Zugriff geben kannst. Die Daten sind dort transportverschlüsselt (TLS) und auf
> dem Datenträger verschlüsselt gespeichert, aber **nicht Ende-zu-Ende-verschlüsselt**: Wir
> können sie technisch einsehen. Wir tun das nur, soweit es für Betrieb, Fehlerbehebung oder auf
> deine Anfrage (Support) nötig ist. Eine Kopie bleibt als Offline-Lesekopie in deinem Browser.
> Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
>
> Soweit darin Daten deiner eigenen Kunden enthalten sind, verarbeiten wir sie **in deinem
> Auftrag** (Art. 28 DSGVO); der Auftragsverarbeitungsvertrag ist Bestandteil der AGB (Anlage).

**Annahme:** „auf dem Datenträger verschlüsselt“ — Supabase/AWS verschlüsselt at rest laut
Anbieter; vor Übernahme in der Supabase-Sicherheitsdoku bestätigen (👤).

### B3 Stackr wird Auftragsverarbeiter der Nutzer → AVV-Anlage fehlt

Heute (`datenschutz.html:120-121`) ist Stackr „nur technisches Werkzeug“. Mit Klartext auf dem
Server verarbeitet Stackr die Kundendaten der Nutzer (Rechnungsempfänger, Shopify-Bestellungen)
im Auftrag → Art. 28 Abs. 3 DSGVO verlangt einen Vertrag. **Fehlt komplett.** Braucht:
AVV-Muster als AGB-Anlage (Gegenstand, Dauer, Art/Zweck, Kategorien, Weisungen, TOM, Liste der
Unterauftragsverarbeiter: Supabase, Vercel, Upstash bis Abschaltung; Löschung/Rückgabe bei
Vertragsende). → Anwalt.

### B4 AGB §7 neu (Vorschlag)

> **§7 Datenspeicherung, Export und Kündigung.** (1) Buchhaltungsdaten speichert der Anbieter
> auf Servern in der EU (Frankfurt) bei Auftragsverarbeitern; Einzelheiten in der
> Datenschutzerklärung. (2) Der Nutzer kann seine Daten jederzeit vollständig exportieren
> (CSV/XLSX, Gesamt-Export). (3) Nach Vertragsende bleiben die Daten ⟦N⟧ Tage nur lesend zum
> Export verfügbar und werden danach gelöscht, soweit der Nutzer nicht zuvor die weitere
> Aufbewahrung gebucht hat. Gesetzliche Aufbewahrungspflichten (§ 147 AO, § 14b UStG) treffen
> den Nutzer; der Anbieter weist vor der Löschung per E-Mail darauf hin.

**Offene Produktfrage (nicht raten, Regel 9):** Was passiert mit Serverdaten nach Kündigung —
Frist ⟦N⟧, Lese-Zugang, Archiv-Option? Ohne Antwort ist §7 (3) nicht formulierbar.

### B5 Shopify — Rolle, Daten, Text

Code-Befund (gut, datensparsam):
- Scopes `read_orders,read_shopify_payments_payouts` (Memory/Config, nicht im Code fest).
- Gespeichert in `shopify_eingang.payload`: Bestell-ID/-nummer, Datumsangaben, Beträge,
  Positionen, Zahlungsart, **nur Ländercode** der Liefer-/Rechnungsadresse — **kein Name, keine
  E-Mail, keine Anschrift** (`js/shopify-buchung.js` `ausGraphQL`, „Käufername wird nicht
  übernommen“).
- Webhook-Rohinhalt (mit Namen/Adresse) wird nur auf HMAC geprüft und **nicht** gespeichert
  (`api/shopify-webhook.js:7-9`); Logs ohne Payload.
- Zugriffstoken AES-GCM-verschlüsselt (`SHOPIFY_TOKEN_KEY`), Pflicht-Webhooks
  `customers/redact`, `shop/redact` löschen wirklich; `customers/data_request` wird nur gemeldet.

Rollen: Nutzer (Händler) = Verantwortlicher für Käuferdaten; Stackr = **Auftragsverarbeiter des
Nutzers** (→ B3); Shopify = Auftragsverarbeiter des Händlers bzw. eigenständig für die
Plattform — gegenüber Stackr kein AV-Verhältnis. Whop unverändert eigenständig.

**Lücke P1:** `shopify_eingang` hat keine Löschfrist — Zeilen bleiben nach `verarbeitet` ewig
(einzige Deletes: redact/uninstall, `20261022000001_shopify.sql:89-99`). Vorschlag: nach
Buchung löschen oder 90 Tage nach `verarbeitet_am`.
**Hinweis:** `app/uninstalled` löscht das Token sofort (`token_chiffrat = null`,
`20261022000001_shopify.sql:77-80`); Bestelleingang bleibt bis `shop/redact` (laut Shopify
48 h nach Deinstallation). Im Text so beschreiben.

DSE-Vorschlag, neue Ziffer 4.5:
> **4.5 Shopify-Anbindung (optional).** Verbindest du deinen Shopify-Shop, erhalten wir nach
> deiner Freigabe in Shopify ein Zugriffsrecht, um Bestellungen und Auszahlungen zu lesen
> (`read_orders`, `read_shopify_payments_payouts`). Wir speichern je Bestellung nur
> Bestellnummer, Datum, Beträge, Artikel, Zahlungsart und das Land der Liefer-/Rechnungsadresse,
> nicht Namen, E-Mail-Adressen oder Anschriften deiner Käufer. Shopify übermittelt uns bei neuen
> Bestellungen eine Benachrichtigung, die solche Angaben enthält; wir werten sie nur zur Prüfung
> der Echtheit aus und speichern sie nicht. Das Zugriffsrecht speichern wir verschlüsselt bei
> Supabase (Frankfurt). Hinsichtlich der Käuferdaten handeln wir in deinem Auftrag (Ziffer 7).
> Trennst du die Verbindung oder deinstallierst du die App, löschen wir Zugriffsrecht und
> Bestelleingang ⟦spätestens nach 48 Stunden / sofort⟧. Rechtsgrundlage: Art. 6 Abs. 1 lit. b
> DSGVO.

**Shopify-Livetest heute (Dev-Store, Testdaten):** unkritisch. Erster **echter** Shop erst nach
DSE 4.5 + AVV (B3).

### B6 TIA Supabase muss neu

Wiedervorlage-Bedingung der TIA („wenn Klartext zu Supabase gelangt“) tritt mit R ein. Die
Bewertung stützt sich auf EDSA-Anwendungsfall 1 (nur Chiffrat) — fällt weg. Nur SCC, kein DPF
→ neue Bewertung mit: Finanz-/Kundendaten im Klartext, Region Frankfurt, Verschlüsselung at
rest durch AWS (Schlüssel beim Anbieter — keine wirksame Zusatzmaßnahme gegen Herausgabe),
EO 14086. Ergebnis offen → Anwalt. Alternative prüfen lassen: ob Supabase einen EU-Vertragspartner
anbietet (👤 Supabase Legal Documents).

### B7 Einwilligung/Informationsgrundlage für den Umzug

Umbauplan Abschnitt 3: Dialog mit „ausdrücklicher Bestätigung“. Rechtsgrundlage ist
Vertragserfüllung nach Leistungsänderung (AGB §2 Abs. „Funktionsumfang anpassen“, `agb.html:66`)
bzw. AGB-Änderung nach §9 — **keine Einwilligung** nach Art. 6 Abs. 1 lit. a, sonst müsste sie
widerrufbar sein und der Dienst ohne sie weiterlaufen (Plan sieht das ausdrücklich nicht vor).
Formulierung des Dialogs daher als **Information + Zustimmung zur Vertragsänderung**, nicht als
„Einwilligung“. → Anwalt.

---

## P1

### C1 VVT (`compliance/verzeichnis-verarbeitungstaetigkeiten.md`, Stand 23.06.) veraltet

Fehlt komplett: Cloud-Sync, Belege (Vercel Blob), Whop-Sitzungen, Rate-Limits (IP),
Fehlerprotokolle, Reichweitenmessung (Vercel Web Analytics, Einwilligung), Kündigung,
Betriebsalarme (`ops_alerts`, Make, Vercel Blob), Shopify, künftig Buchhaltungsdaten
serverseitig. Falsch: VT-1 nennt CDN jsDelivr (seit Aug. 2026 entfernt, `cookies.html:262-266`),
Produkt-URL nur `track-your-income-app.vercel.app` (getstackr.de fehlt), VT-4/TOM „local-first“.
Neue Einträge (Ü1-Stand, bei R ergänzen):

| VT | Zweck | Daten | Empfänger (AV) | Drittland | Löschfrist | Rechtsgrundlage |
|---|---|---|---|---|---|---|
| Cloud-Sync | Mehrgeräte-Abgleich | Whop-`user_id`, Chiffrat, Version, Zeit, Geräte-ID | Upstash, Supabase, Vercel | USA mögl.: DPF (Upstash, Vercel), SCC (Supabase) | bis Löschung; Anker nach Aufbewahrungsfrist | 6(1)(b)/(a) |
| GoBD-Anker | Unveränderbarkeitsnachweis | `user_id`, Hash, Kennung, Zeit | Upstash, Supabase | dto. | Ende Aufbewahrungsfrist | 6(1)(c), 17(3)(b) |
| StB-Freigabe | Lesezugriff Dritter | Public Keys, Grants | Upstash, Supabase | dto. | bis Widerruf | 6(1)(a) |
| Belege | Ablage | Chiffrat, Pfad mit `user_id`; IP beim Abruf | Vercel Blob (fra1) | DPF | bis Löschung | 6(1)(b) |
| Login-Sitzung | Token-Erneuerung | Sitzungs-ID, Whop-Tokens (Supabase verschlüsselt) | Upstash, Supabase | dto. | 30 Tage | 6(1)(b) |
| Missbrauchsschutz | Rate-Limit | IP, `user_id` | Upstash | DPF | 60 s (Supabase: ≤ 24 h) | 6(1)(f) |
| Fehlerzähler | Fehlerbehebung | bereinigter Fehlercode, Datei, Zeile | Upstash; Tageszusammenfassung Make, Vercel Blob | DPF / ⟦Make⟧ | 30 Tage | 6(1)(f) |
| Reichweite | Statistik öffentl. Seiten | Seite, Referrer, Gerät, Land | Vercel | DPF | ⟦Vercel-Angabe⟧ | 6(1)(a), § 25(1) TDDDG |
| Kündigung | § 312k BGB | Name, E-Mail, Art, Grund, Kennung, Zeit | Supabase, Whop (Abgleich), Make (Mail) | SCC / Whop eigenst. / ⟦Make⟧ | 3 J. nach Jahresende | 6(1)(c), (f) |
| Betriebsalarme | Betrieb | Quelle, Ereignis, Detail (≤ 500 Zeichen) | Supabase, Vercel Blob, Make | dto. | 30 Tage / 10 000 Zeilen | 6(1)(f) |
| Shopify | Import Bestellungen | Bestelldaten ohne Käuferidentität, Token (verschl.) | Supabase, Vercel | SCC/DPF | ⟦offen, B5⟧ | 6(1)(b); Art. 28 ggü. Nutzer |

**Annahme:** Inhalt von `ops_alerts.detail` kann im Fehlerfall personenbezogene Bruchstücke
enthalten (`api/_alert.js`, `detail` auf 500 Zeichen gekürzt, nicht bereinigt) — vor Übernahme
stichprobenartig prüfen.

### C2 Make.com fehlt als Auftragsverarbeiter

DSE nennt Make bei Fehlerzusammenfassung (`datenschutz.html:147`) und Kündigung (`:360-361`),
aber **nicht** in Ziffer 7. Make verarbeitet Name + E-Mail der Kündigenden → AV.
Frage an User (👤): DPA mit Make (Celonis) akzeptiert? Datenregion des Make-Kontos (EU1/US)?
Vorschlag Ziffer 7, Ergänzung:
> **Make.com** (Celonis SE ⟦bzw. Vertragspartner laut DPA⟧) — Versand der Kündigungsbestätigung
> und interner Betriebsmeldungen; ⟦Region⟧.

### C3 GoBD-Verfahrensdokumentation (`compliance/gobd-verfahrensdokumentation.md` + `verfahrensdokumentation.html`)

Heute (Ü1) nur Stand/Änderungshistorie nachziehen (A1). Mit R neu zu schreiben:

| Abschnitt | heute | Endstand (Vorschlag) |
|---|---|---|
| Systembeschreibung (compl. :14-16) | local-first, keine Server-Speicherung | Server führt: Supabase Postgres (Frankfurt) über `api/` (Vercel); Browser hält Offline-Lesekopie; offline nur lesen (Entscheidung 22.10.) |
| Unveränderbarkeit (:26-31) | „nur eingeschränkt erzwingbar“ | serverseitig: Trigger lehnt Änderung gesperrter/festgeschriebener Datensätze ab (`perioden`), Audit-Log nur INSERT mit Hash-Kette, Nummernkreise serverseitig lückenlos (`20261022000002_server_datenmodell.sql`) |
| Zugriff | Whop-Login | Rollen `owner` / `stb_lesen` je Firma (`company_members`), RLS über `stackr_app` |
| Datensicherung (:33-36) | Sache des Nutzers | Supabase-Backups ⟦Frequenz/Aufbewahrung laut Pro-Plan bestätigen 👤⟧ + Export |
| Aufbewahrung/Löschung (:38-42) | Nutzerpflicht | Serverlöschung erst nach Vertragsende + Frist (B4); Löschsperre innerhalb § 147 AO nur auf Nutzerwunsch aufhebbar ⟦Produktentscheidung⟧ |
| Datenzugriff Finanzverwaltung (§ 147 Abs. 6 AO) | fehlt | Z1/Z2/Z3: Lesezugang StB-Rolle bzw. Export im Prüferformat ⟦DATEV/GDPdU-Export vorhanden?⟧ |

**Annahme:** Abschnitte Unveränderbarkeit/Zugriff beschreiben `20261022000002` (committet, nicht
in Prod). Erst übernehmen, wenn diese Migration live ist.

---

## P2

### D1 Impressum (`impressum.html`)

- Angaben nach § 5 DDG vollständig (Name, Anschrift, E-Mail; keine USt-IdNr. nötig, KU).
- **Begründungssatz falsch zitiert:** „Nach EuGH-Urteil C-298/07 ist eine E-Mail-Adresse … ausreichend“.
  Der EuGH verlangt **neben** der E-Mail einen zweiten schnellen, unmittelbaren Kommunikationsweg
  (z. B. Kontaktformular; Telefon nur auf Anfrage nicht zwingend). Vorschlag: Satz streichen und
  einen zweiten Weg nennen, z. B. Kontaktformular — oder: „Auf Anfrage nennen wir dir
  kurzfristig einen telefonischen Kontakt.“ Ob das reicht → Anwalt.
- Domain: Impressum ist unter getstackr.de und der alten Adresse dieselbe Seite (gleicher
  Deploy) — ok. VVT nennt nur die alte Domain (C1).
- Streitschlichtung: OS-Plattform-Link fehlt korrekt (Plattform seit 20.07.2025 eingestellt);
  VSBG-Hinweis vorhanden.

### D2 AI Act Art. 50 — kein Fall (bestätigt)

- Beleg-OCR: `tesseract.js` läuft lokal, lädt Modell vom eigenen Server
  (`datenschutz.html:292-310`); keine Interaktion im Sinne eines Chatbots, keine Erzeugung
  synthetischer Inhalte, keine Emotionserkennung → Art. 50 Abs. 1–4 greifen nicht.
- Kein externer KI-Dienst im Code (grep 0 Treffer).
- Hinweis: Wird OCR als KI-System i. S. v. Art. 3 Nr. 1 eingeordnet, bleibt nur die allgemeine
  KI-Kompetenzpflicht des Betreibers (Art. 4) — für den Einzelunternehmer formlos erfüllbar.

### D3 Stand-Daten

`datenschutz.html` „Oktober 2026“ (ok), `cookies.html` und `verfahrensdokumentation.html:26`
(„Juli 2026“) bei Einbau von A1 nachziehen.

---

## Reihenfolge-Empfehlung

1. **Heute/ohne Anwalt-Wartezeit möglich (rein faktisch):** A4 Migration Kündigung (User),
   A1+A3 Ü1-Texte inkl. Opt-in-Dialog, A2 Transfergrundlage, A5 Hinweis — Freigabe der Wortlaute
   durch den User; Anwalt sieht sie mit dem Paket.
2. **Vor erstem echten Shopify-Shop:** B3 AVV-Anlage, B5 DSE 4.5, Löschfrist `shopify_eingang`.
3. **Vor R-Livegang (Klartext):** B1–B4, B6, B7, C1, C3; Landing-Werbung (B1 letzte Zeilen)
   **im selben Deploy** wie das Umschalten.
4. C2, D1 mit dem nächsten Anwaltstermin.

## Fragen an den User (👤) — Antworten 2026-10-24

1. Make.com: DPA akzeptiert, Region des Kontos? (C2) → **unbekannt.** Bleibt offen: im
   Make-Konto unter Organisation → Legal/DPA und Region (EU1/US1) nachsehen. Bis dahin Make in
   Ziffer 7 **nicht** aufgenommen (keine Behauptung eines DPA).
2. Serverdaten nach Kündigung: Frist und Lese-Zugang? (B4) → **„werden gelöscht, nach 6 Monaten
   oder 30 Tagen, unsicher“.** Nicht geraten (Regel 9): ⟦N⟧ bleibt offen. Hinweis: Der Umbauplan
   (Abschnitt 3) nennt 6 Monate nur als Stichtag für Kunden, die nie umziehen, und 30 Tage für das
   alte Cloud-Sync-Chiffrat nach erfolgreichem Umzug — beides ist **keine** Regel für Daten nach
   Vertragsende. Muss vor R-Livegang entschieden werden.
3. Supabase-Backups: → **nächtlich, Aufbewahrung unbekannt.** In Supabase → Database → Backups
   ablesen (Pro: laut Anbieter tägliche Backups mit begrenzter Aufbewahrung — Zahl dort
   bestätigen). Wichtig für Art. 17: gelöschte Daten leben bis zum Ablauf im Backup weiter → in
   DSE Ziffer 8 nennen, sobald die Zahl feststeht.
4. Ü1-Texte: → **einbauen.** Erledigt 2026-10-24: A1 (DSE 4.1, 4.3, 6.1, cookies.html:192,
   Opt-in-Dialog `js/cloud-sync.js`, Verfahrensdoku Abschnitt 1 + Historie + Stand), A2 (Ziffer 7
   als Liste, Supabase nur SCC, AWS Frankfurt + Subprozessor-Link), A3 (Ziffer 5 Sitzungen).
   Annahme: Spiegel-Beginn 14.10.2026 (Datum von `STORAGE_MIRROR` aus der Vercel-Liste laut
   Memory) für die Historie der Verfahrensdoku.

**A4 erledigt 2026-10-24:** Migration `20261024000001_kuendigungen` per Supabase-Connector in
`stackr-prod` eingespielt (User: „mach das alles für mich“). Geprüft: RLS an, anon ohne Tabellen-
und Funktionsrecht, `service_role` darf ausführen; `sync_kuendigung_add` + `_status` in einer
zurückgerollten Transaktion getestet (keine Zeile übrig, Sequenz steht danach auf 1 → erste echte
Kündigung bekommt K-2). Im Preview-Projekt (fremde Organisation) nicht eingespielt.
**A5 erledigt 2026-10-24:** In-App-Fenster `_maybeNotifyAnbieterwechsel()` in `js/cloud-sync.js`
(einmal, nur bei aktivem Sync mit Schlüssel, nicht über ein offenes Fenster; neu Aktivierende
ausgenommen), Merker `oyi_sync_hinweis_supabase` in `cookies.html`, Test
`test/test-hinweis-anbieterwechsel.js`. Whop-Mail als Entwurf 3 in `plan/whop-mails-entwuerfe.md`
— **verschicken muss der User** (Claude meldet sich nicht bei Whop an).

Nebenfund beim Testlauf: `test/test-server-datenmodell.js` schlägt auf `origin/master` fehl
(„Vorlage gefunden: from public, anon, authenticated, service_role“) — liest nur Migrationen,
unabhängig von diesem Audit.
