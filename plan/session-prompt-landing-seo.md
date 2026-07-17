# Prompt für neue Session (copy-paste) — P1-2: Landing-Copy + SEO

---

Kontext: Stackr steht kurz vor Launch. Die Landing-Page (`index.html`, live an `/`) hat
bereits solide SEO-Grundlagen (Title, Description, canonical, OG/Twitter-Tags,
`sitemap.xml`, `robots.txt`) — das ist NICHT bei null. Aufgabe: die verbleibenden Lücken
schließen und die Copy vor dem Launch nochmal kritisch lesen (Klarheit, Conversion,
Widersprüche zu AGB/Preis).

Zentrale Dateien: `index.html` (LIVE, an `/` ausgeliefert — kein Rewrite in `vercel.json`
nötig, Vercel serviert `index.html` automatisch als Root), `landing-v2.html` (Status
unklar — geprüft in dieser Recherche: **nicht** über `vercel.json`-Rewrite erreichbar,
aber dupliziert `canonical`/`og:url` auf `https://track-your-income-app.vercel.app/`,
obwohl die Seite selbst nicht unter `/` liegt), `sitemap.xml`, `robots.txt`,
`deploy/index.html` + `deploy/onepager.html` (weitere Landing-Varianten, Zweck erst klären).

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## 1. Erstmal Bestandsaufnahme: welche Landing-Variante ist die echte?

- `index.html`, `landing-v2.html`, `deploy/index.html`, `deploy/onepager.html` existieren
  parallel mit unterschiedlichen Titles/Copy. Klären: ist `landing-v2.html` ein totes
  Prototyp/A-B-Test-Artefakt oder soll sie live? `deploy/` könnte ein separates
  Deploy-Ziel sein (Ordnername prüfen, ob es ein eigenes Vercel-Projekt ist oder Altlast).
- Falls `landing-v2.html` tot ist: canonical/og:url-Duplikat ist ein reines SEO-Risiko
  (Suchmaschinen könnten sie als Duplicate Content werten) — entweder Datei entfernen,
  `noindex` setzen, oder eigenen canonical setzen. Beim User rückfragen, NICHT einfach
  löschen ohne zu wissen ob sie noch gebraucht wird.

## 2. SEO-Feinschliff auf der echten Landing-Page

- `sitemap.xml` listet nur `/`, `agb.html`, `datenschutz.html`, `impressum.html`,
  `cookies.html`, `refund.html` — fehlt `verfahrensdokumentation.html`? Prüfen ob die
  öffentlich/indexierbar sein soll (aktuell nicht in `robots.txt` `Allow`-Liste).
- `og-image.png` — existiert die Datei tatsächlich unter dem referenzierten Pfad? Prüfen,
  Bildgröße/Format gegen OG-Standard (1200×630) checken.
- Structured Data (JSON-LD, z. B. `SoftwareApplication`/`Organization`/`FAQPage` für die
  FAQ-Sektion auf `index.html`) fehlt komplett — prüfen ob sinnvoll ergänzbar ohne die
  bestehende CSP (`script-src 'none'` auf Rechtsseiten, prüfen was auf `index.html` gilt)
  zu brechen.
- H1/H2-Hierarchie auf `index.html` gegenchecken (nur eine H1?), Alt-Texte an allen
  `<img>`/SVG-Icons mit Bedeutung.

## 3. Copy-Review (kritisch lesen, nicht nur SEO)

- FAQ-Antwort zu Steuerberatung (`index.html`, Suche nach "Steuerberater") gegen
  `agb.html §31` (StBerG-Disclaimer) abgleichen — konsistente Formulierung?
- Preis-Kommunikation (15 €/Monat, 135 €/Jahr, 7-Tage-Trial mit Kartenpflicht) auf der
  Landing exakt gegen `agb.html §4` (Trial-Bedingungen) und `js/user-plan.js` prüfen —
  keine widersprüchlichen Zahlen/Bedingungen zwischen Marketing-Text und Rechtstext.
  (Hinweis: `agb-writer`/`legal-reviewer`-Agent für den Rechtstext-Abgleich nutzen, nicht
  selbst umformulieren.)
- CTA-Texte + Trial-Links: nach der W2-Session (CH/AT-Entfernung, 2026-07-16) prüfen, ob
  irgendwo noch "auch für die Schweiz" o. ä. suggeriert wird (war zuvor an mehreren
  Stellen der Fall, siehe Memory `ch-at-removal-web.md`).

## 4. Technisches SEO-Minimum

- Lighthouse-SEO-Score der Landing im Preview messen (vor/nach).
- `Content-Security-Policy` auf `index.html` gegenlesen — blockiert sie evtl. legitime
  Crawler-relevante Ressourcen (z. B. `og-image.png` selbst gehostet? `img-src` prüfen)?
- Mobile-Lesbarkeit der FAQ/Pricing-Sektion im Preview (375px Breite) checken.

## Abschluss

- Jede inhaltliche Copy-Änderung mit Begründung dokumentieren (nicht blind umschreiben).
- Rechtstext-Abgleich klar von reiner SEO-Technik trennen — bei Unsicherheit über
  Preis-/Trial-Formulierungen lieber fragen statt raten (Anwalt-Freigabe für AGB steht
  laut `plan/offene-punkte-2026-07-15.md` noch aus, Landing-Copy sollte dem nicht
  vorgreifen).
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P1-2 nachtragen.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Sonnet 5.** Grund: überwiegend Recherche + Textarbeit + kleine,
gut abgrenzbare technische Fixes (Meta-Tags, Sitemap, JSON-LD) ohne tiefe Systemlogik —
kein Fall für Opus-Reasoning, aber der Rechtstext-Abgleich sollte konservativ bleiben
(im Zweifel fragen statt selbst entscheiden).
