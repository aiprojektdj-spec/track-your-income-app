# Prompt für neue Session (copy-paste) — Vercel Blob als Empfänger nachtragen + cookies.html-Kleinfunde

---

Kontext: Beim Umsetzen von `plan/session-prompt-vollaudit-runde2-nacharbeiten.md` (Punkt 2,
cookies.html) hat der `legal-reviewer`-Agent am 2026-07-25 einen Fund gemeldet, der **schwerer
wiegt als der ursprüngliche Anlass** und bewusst aus jener Session herausgehalten wurde, weil er
eine Sachverhaltsklärung durch den User braucht (Vercel-Konsole).

Die Cookie-/Key-Tabelle selbst ist bereits erledigt (Commit `0733e77`). Diese Session macht den
Rest.

## 0. Vorab durch den User zu klären (nicht automatisierbar)

**In welcher Region liegt der Vercel-Blob-Store?** Vercel-Dashboard → Storage → der genutzte
Blob-Store → Region. Ohne diese Angabe lässt sich Punkt 1 nicht sauber zu Ende schreiben:
- Liegt er in der EU → einfache Ergänzung des Empfängers, Regionszusage bleibt haltbar.
- Liegt er außerhalb der EU → zusätzlich Drittlandtransfer nach Art. 44 ff. DSGVO offenzulegen
  (Rechtsgrundlage, Garantien/SCC). Dann bitte auch prüfen, ob sich der Store in eine EU-Region
  umziehen lässt — das wäre die deutlich sauberere Lösung als eine Transferklausel.

Solange das offen ist: **nicht raten**. Lieber neutral formulieren (siehe Punkt 1) als eine
zweite falsche Regionszusage in einen Rechtstext schreiben.

## 1. Vercel Blob als Speicherort/Empfänger nachtragen 🔴

**Befund:** `cookies.html` behauptet, bei aktivem Cloud-Sync werde
*„ausschließlich unlesbares Chiffrat bei Upstash (Frankfurt, EU) abgelegt"*. Das ist nachweislich
unvollständig. Bei Überschreiten des Inline-Limits lädt der Client **das komplette verschlüsselte
Ledger** sowie große Anhänge (Rechnungslogo, Eigenbeleg-Foto/-PDF) zu **Vercel Blob** hoch:

- `js/cloud-sync.js` — `pushBody.blobUrl = await BlobAttachments.put(...)` (zwei Stellen:
  regulärer Push über `MAX_INLINE_CIPHER` und der 413-Retry)
- `js/blob-attachments.js` — `offloadLargeFields()` lagert Felder > Schwellwert aus
- `api/blob-upload.js` — Ziel-Host `https://….public.blob.vercel-storage.com/`

Rechtlich sind das **zwei getrennte Probleme**:
1. Vercel Blob ist ein **nicht genannter Empfänger** (Art. 13 Abs. 1 lit. e DSGVO).
2. Die Regionszusage „Frankfurt, EU" gilt **nur für Upstash** und deckt den Blob-Store nicht ab.

Dass der Inhalt reines Chiffrat ist, ändert an der Nennungspflicht nichts.

**Betroffen sind drei Dateien — alle drei anfassen, sonst bleibt der Widerspruch:**
- `cookies.html` — Abschnitt 2, der Cloud-Sync-Absatz (die Stelle mit „ausschließlich … Upstash")
- `datenschutz.html` — Ziffer 4; nennt Upstash + Vercel („Transport-Funktion"), aber Vercel Blob
  als *Speicherort* fehlt
- `verfahrensdokumentation.html` — dieselbe Lücke im Abschnitt zur Datenhaltung

Formulierungsvorschlag solange die Region ungeklärt ist: Upstash **und** Vercel Blob als
Speicherorte nennen, die EU-Zusage explizit nur auf Upstash beziehen und für den Blob-Store
keine Regionsaussage treffen. Sobald die Region feststeht, präzisieren.

Bei Bedarf den `legal-reviewer`-Agent für die konkrete Formulierung heranziehen — er hat den
Fund gemacht und kennt den Kontext.

## 2. cookies.html — fünf Kleinfunde aus demselben Review

Alle in `cookies.html`, alle unabhängig voneinander umsetzbar:

1. **Stand-Datum veraltet** (Zeile ~25): „Stand: Juni 2026" → Juli 2026. Seit Juni hat sich der
   beschriebene Sachverhalt geändert (Blob-Architektur seit 2026-07-15). Sinnvollerweise erst
   ganz am Ende dieser Session setzen, wenn alle Textänderungen drin sind.
2. **§-Zitat schief**: „Rechtsgrundlage für alle o. g. Technologien: § 25 Abs. 2 TDDDG". § 25
   Abs. 2 ist eine *Ausnahme vom Einwilligungserfordernis*, keine Rechtsgrundlage für die
   Verarbeitung. Sauber: Zugriff aufs Endgerät einwilligungsfrei nach **§ 25 Abs. 2 Nr. 2
   TDDDG**, Rechtsgrundlage der Verarbeitung **Art. 6 Abs. 1 lit. b DSGVO**. Die Nummer (Nr. 2)
   auch in Abschnitt 3 ergänzen.
3. **Abschnitt 5 gibt eine praktisch falsche Handlungsanweisung**: Der Text rät, „Stackr-Cookies"
   zu löschen. Stackr setzt aber **kein einziges** `document.cookie` — wer nur Cookies löscht,
   löscht bei Stackr gar nichts; Abmeldung und Datenverlust hängen an localStorage/IndexedDB.
   Umformulieren auf „Cookies **und lokal gespeicherte Website-Daten**" plus deutlicher
   Warnhinweis, dass das Löschen der Website-Daten nicht gesicherte Buchhaltungsdaten vernichtet,
   mit Verweis auf die Backup-Funktion. Wegen § 147 AO auch GoBD-relevant.
4. **jsDelivr-Wording zu weich**: „kann deine IP-Adresse an CDN-Server übertragen werden" — bei
   einem Fremd-CDN ist das kein „kann", sondern technisch zwingend. → „wird … übertragen".
   Als Dauerlösung erwägen, die Bibliotheken selbst zu hosten (wie bei den Fonts in
   `css/legal.css` schon geschehen) — dann entfällt die Klausel ganz.
5. **IndexedDB-Beschreibung untertreibt**: „für größere Datenmengen (z. B. umfangreiche
   Buchungshistorie)". Dort liegen laut `js/blob-attachments.js` auch **Rechnungslogos,
   Eigenbeleg-Fotos und PDFs** als Base64 — potenziell personenbezogene Daten Dritter
   (Lieferanten, Kunden), und genau diese Felder werden beim Cloud-Sync ausgelagert. Benennen.

Zusatzhinweis desselben Reviews (optional, kein Verstoß): Abschnitt 4 „Drittanbieter" nennt
Whop und jsDelivr korrekt, aber weder Upstash noch Vercel — obwohl Abschnitt 2 Upstash als
Speicherort bereits thematisiert. Mindestens ein Querverweis auf `datenschutz.html` Ziffer 4
ans Ende von Abschnitt 4.

## Hinweise zur Umsetzung

- `css/legal.css` definiert **nur** `.badge-required` — jede andere Badge-Klasse rendert
  unstyled. Gilt für alle Rechtstext-Seiten.
- Repo ist UTF-8 ohne BOM; nicht über eine PowerShell-Textpipeline editieren, sondern
  Edit/Write oder Python verwenden.
- Nach jeder Textänderung an einer Seite mit Meta-CSP daran denken: die Seiten haben seit
  `f687a51` zusätzlich einen CSP-**Header** aus `vercel.json`. Wer eine neue Seite anlegt, muss
  dort einen Eintrag ergänzen. Zum Gegenprüfen gibt es `scripts/csp-preview-server.js`
  (liefert die echten Header lokal aus, `node scripts/csp-preview-server.js`).
- Pro logischer Änderung ein eigener Commit.

## Abschluss

- `plan/vollaudit-runde2-2026-07-25.md` — Prioritäten-Tabelle am Ende um den Vercel-Blob-Fund
  ergänzen bzw. dessen Status fortschreiben.
- Diese Datei danach löschen oder als erledigt markieren.

---

**Modell-Empfehlung: Sonnet 5.** Reine Rechtstext-Arbeit mit klar umrissenem Scope. Die einzige
echte Abwägung (Formulierung bei ungeklärter Blob-Region) gehört an den `legal-reviewer`-Agent.
