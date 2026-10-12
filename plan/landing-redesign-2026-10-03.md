# Stackr Landing Page – Redesign von Grund auf (03.10.2026)

## Ziel

Die Landing Page (`index.html`, 917 Zeilen) wird **komplett neu** gebaut, nicht
umgebaut. Das gilt für Struktur, Design und Copy. Dazu kommt ein **komplett neuer
Render**: das Hero-Visual bzw. Produkt-Mockup der App.
Gebaut wird mit Opus 5.5 in einer eigenen Session bzw. einem eigenen Branch.

## Vorher klären (Fragen an dich)

- [ ] Was stört an der aktuellen Seite am meisten? (Look, Copy, Conversion, Mobile?)
- [ ] Referenzen: 2–3 Seiten, die dir gefallen (z. B. Linear, Lexoffice, Qonto …)
- [ ] Render: Was soll er zeigen? App-Dashboard im Laptop/Phone-Mockup, abstrakter 3D-Render
      oder echter Screenshot? Wird er generiert (KI-Bild) oder als HTML/CSS bzw. SVG gebaut?
- [ ] Bleibt `landing-v2.html` (401 Zeilen) als Ideenquelle oder fliegt sie raus?
- [ ] Dark, Light oder beides?

## Rahmen (nicht verhandelbar)

- **Statisches HTML/CSS/JS** wie bisher, kein Framework-Wechsel. Der Build läuft über
  `build-deploy.py`.
- **CSP**: `script-src 'self'`, keine Inline-Skripte, keine externen CDNs. Fonts lokal
  aus `fonts/`.
- Rechtliche Links bleiben: Impressum, Datenschutz, AGB, Cookies, Widerruf/Refund,
  Barrierefreiheit
- **Barrierefreiheit**: WCAG 2.1 AA (Kontraste, Fokus, Skip-Link, Alt-Texte). Die Seite
  hat eine Erklärung, die darf nicht schlechter werden.
- **Preisangaben** korrekt (Kleinunternehmer § 19: „keine USt ausgewiesen")
- SEO: `<title>`, Meta-Description, OG-Image (`og-image.png` neu zum neuen Render),
  `sitemap.xml`, strukturierte Daten
- Performance: LCP < 2,5 s mobil, Render als AVIF/WebP mit `width`/`height`

## Ablauf

1. **Branch** `redesign/landing-2026-10` anlegen. ⚠️ Im Repo liegen gerade uncommittete
   Änderungen (`agb.html`, `app.html`, `build-deploy.py`, `cookies.html`, `css/legal.css`).
   Diese **zuerst committen oder stashen**, damit sie nicht im Redesign landen.
2. **Copy zuerst**: Agent `stackr-marketing` schreibt die neue Struktur (Hero, Problem,
   Features, Vergleich mit sevDesk/lexoffice, Preis, FAQ, CTA). Danach entscheidest du.
3. **Design-Richtung**: 2–3 Varianten als Skizze (Skill `ui-ux-pro-max` / `frontend-design`).
   Du wählst eine.
4. **Render** erstellen bzw. generieren, in zwei Größen exportieren, OG-Image ableiten
5. **Bauen** als neue `index.html` plus eigene CSS-Datei. Die alte bleibt bis zum Go als
   `index-alt.html` (nicht deployen).
6. **Prüfen**: `/accessibility`, `/performance-audit`, `/ui-checker`, mobil 375 px,
   Dark Mode, CSP-Fehler in der Konsole = 0
7. Preview-Deploy auf Vercel, Freigabe durch dich, dann Production

## Erledigt-Kriterium
Neue Seite live, Lighthouse mobil ≥ 90 in allen vier Kategorien, keine CSP-Fehler, alle
Rechtslinks erreichbar, neuer Render und neues OG-Image eingebunden.
