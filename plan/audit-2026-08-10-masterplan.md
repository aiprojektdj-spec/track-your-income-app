# Großer Vollaudit — Masterplan (Stand 2026-08-10)

**Scope:** Technisch/Security, Steuer/GoBD/Recht, UX/Design/A11y, Business/Markt.
**Codebase:** nur Web 1.7.
**Ausführung:** jedes Thema in einer eigenen, dedizierten Session — Ergebnisse werden hier
gesammelt und priorisiert, nicht automatisch gefixt (Ausnahme: offensichtlich triviale Fixes
können auf Zuruf direkt mitgenommen werden, sonst landet alles erst in dieser Liste).

Jede Zeile = eine eigene Session. Start dort einfach mit dem angegebenen Skill-Befehl
(`/security-stackr` etc.) — der Skill selbst ist die Audit-Definition, es braucht keinen
zusätzlichen Prompt-Text. Nach jeder Session: Fund-Datei verlinken, Status hier auf ✅/🟡 setzen,
dann erst die nächste Session starten.

**Wichtiger Hinweis zur Redundanz:** Viele Bereiche wurden in den letzten Wochen bereits
themenweise geprüft (siehe Memory). Ein blinder Vollaudit würde stellenweise Arbeit doppeln.
Spalte „Redundanz" markiert das — bei 🔴 empfehle ich echten Vollaudit, bei 🟡 einen fokussierten
Re-Check (nur Deltas seit letztem Fund), bei 🟢 ist es komplettes Neuland.

---

## Reihenfolge

### A — Technisch/Security

| # | Thema | Befehl | Redundanz | Prio | Status |
|---|---|---|---|---|---|
| 1 | Security (XSS, Whop-Bypass, Cloud-Sync, Secrets, CSP, Rate-Limiting) | `/security-stackr` | 🟡 — Sanierung 2026-08-09 + IP-Spoofing-Fix heute (2026-08-10); Fokus auf Deltas seit dann | Hoch | ✅ [Funde](funde-audit-04-security-delta-2026-08-10.md) |
| 2 | Red-Team (adversarial: Gate-Bypass, Sync-Diebstahl, Injection) | `/red-team` | 🟢 — nie als eigener Lauf dokumentiert | Hoch | ✅ [Funde](funde-audit-01-red-team-2026-08-10.md) |
| 3 | Performance (Bundle, CWV, LocalStorage, Charts, Memory) | `/performance-audit` | 🟢 — nie gemacht | Mittel | ✅ [Funde](funde-audit-09-performance-2026-08-10.md) |
| 4 | UI-Bugs (Rendering, Layout, tote Klassen) | `/ui-checker` | 🟡 — UI-Politur 2026-08-10 deckte nur Lager/Steuer/KSK/EÜR ab, nicht app-weit | Mittel | ✅ [Funde](funde-audit-06-ui-checker-2026-08-10.md) |

### B — Steuer/GoBD/Recht

| # | Thema | Befehl | Redundanz | Prio | Status |
|---|---|---|---|---|---|
| 5 | Steuer-Features (EÜR/UVA/AfA/KSK/Kassenbuch) | `/steuern` | 🟡 — Steuer-Audit 2026-07-23 gründlich; seither neue Features (Teilzahlung, Lager-Batch) ungeprüft | Mittel | ✅ [Funde](funde-audit-10-steuern-delta-2026-08-10.md) |
| 6 | Compliance (DDG/DSGVO/GoBD/AGB/E-Rechnung/UStG) | `/compliance-legal` | 🟡 — GoBD/Legal-Check 2026-07-03, Rechnung/Eigenbeleg-Audit 2026-07-23 | Mittel | ✅ [Funde](funde-audit-11-compliance-legal-2026-08-10.md) |
| 7 | DSGVO-Scan (Consent, Storage, Tracker) | `/datenschutz` | 🟡 — mehrfach behandelt, Anwalt-Freigabe bleibt so oder so offen | Niedrig | ✅ [Funde](funde-audit-14-datenschutz-2026-08-10.md) *(Parallel-Session, f77e80e)* |
| 8 | Steuer-Vergleich vs. sevDesk/lexoffice/FastBill/DATEV | `/vergleich-steuer` | 🟢 — nie gemacht | Mittel | ✅ [Funde](funde-audit-05-vergleich-steuer-2026-08-10.md) |

### C — UX/Design/A11y

| # | Thema | Befehl | Redundanz | Prio | Status |
|---|---|---|---|---|---|
| 9 | Accessibility (WCAG 2.1) | `/accessibility` | 🟡 — A11y-Vollaudit 2026-07-24 + Fokus-Fix heute; „Vollaudit-Rest"-Name deutet an, dass es nie 100 % war | Mittel | ✅ [Funde](funde-audit-12-accessibility-2026-08-10.md) |
| 10 | User-Journey (Onboarding, Friction, Empty-States) | `/ux-journey` | 🟢 — nie gemacht | Hoch | ✅ [Funde](funde-audit-02-ux-journey-2026-08-10.md) |
| 11 | UI-Vergleich vs. Konkurrenz | `/vergleich-ui` | 🟢 — nie gemacht (Design-Brief 2026-06 war Eigenentwicklung, kein Konkurrenzvergleich) | Niedrig | ✅ [Funde](funde-audit-15-vergleich-ui-2026-08-10.md) |

### D — Business/Markt

| # | Thema | Befehl | Redundanz | Prio | Status |
|---|---|---|---|---|---|
| 12 | Monetarisierung (Pricing, Funnel, Churn) | `/monetarisierung` | 🟡 — Funnel 2026-07-11/12 live verifiziert, aber kein systematischer Skill-Lauf | Mittel | ✅ [Funde](funde-audit-13-monetarisierung-2026-08-10.md) |
| 13 | Feature-Gap vs. Konkurrenz | `/feature-gap` | 🟢 — nie gemacht | Hoch | ✅ [Funde](funde-audit-03-feature-gap-2026-08-10.md) |
| 14 | Product-Manager (Roadmap, Positionierung) | `/product-manager` | 🟢 — nie gemacht | Mittel | ✅ [Funde](funde-audit-07-product-manager-2026-08-10.md) |
| 15 | Copy/Marketing (Landing, CTAs, Value-Prop) | `/copy-marketing` | 🟢 — nie gemacht | Mittel | ✅ [Funde](funde-audit-08-copy-marketing-2026-08-10.md) |
| 16 | Technischer Stack-Vergleich | `/vergleich-technisch` | 🟢 — nie gemacht | Niedrig | ✅ [Funde](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md) |
| 17 | Buchhalterischer Vergleich (Rechnungen, Belege, Bank-Import) | `/vergleich-buchhaltung` | 🟢 — nie gemacht | Niedrig | ✅ [Funde](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md) |

---

## Empfohlene Startreihenfolge (nach Prio, 🟢-lastig zuerst innerhalb einer Kategorie)

Jede Zeile hat jetzt eine eigene, fertig ausformulierte Session-Prompt-Datei — einfach in einer
neuen Session öffnen/verlinken und den darin genannten Skill-Befehl starten.

1. [`session-prompt-audit-01-red-team-2026-08-10.md`](session-prompt-audit-01-red-team-2026-08-10.md) — `/red-team`
2. [`session-prompt-audit-02-ux-journey-2026-08-10.md`](session-prompt-audit-02-ux-journey-2026-08-10.md) — `/ux-journey`
3. [`session-prompt-audit-03-feature-gap-2026-08-10.md`](session-prompt-audit-03-feature-gap-2026-08-10.md) — `/feature-gap`
4. [`session-prompt-audit-04-security-delta-2026-08-10.md`](session-prompt-audit-04-security-delta-2026-08-10.md) — `/security-stackr` (Delta-Fokus)
5. [`session-prompt-audit-05-vergleich-steuer-2026-08-10.md`](session-prompt-audit-05-vergleich-steuer-2026-08-10.md) — `/vergleich-steuer`
6. [`session-prompt-audit-06-ui-checker-2026-08-10.md`](session-prompt-audit-06-ui-checker-2026-08-10.md) — `/ui-checker` (app-weit)
7. [`session-prompt-audit-07-product-manager-2026-08-10.md`](session-prompt-audit-07-product-manager-2026-08-10.md) — `/product-manager`
8. [`session-prompt-audit-08-copy-marketing-2026-08-10.md`](session-prompt-audit-08-copy-marketing-2026-08-10.md) — `/copy-marketing`
9. [`session-prompt-audit-09-performance-2026-08-10.md`](session-prompt-audit-09-performance-2026-08-10.md) — `/performance-audit`
10. [`session-prompt-audit-10-steuern-delta-2026-08-10.md`](session-prompt-audit-10-steuern-delta-2026-08-10.md) — `/steuern` (nur neue Features)
11. [`session-prompt-audit-11-compliance-legal-2026-08-10.md`](session-prompt-audit-11-compliance-legal-2026-08-10.md) — `/compliance-legal`
12. [`session-prompt-audit-12-accessibility-2026-08-10.md`](session-prompt-audit-12-accessibility-2026-08-10.md) — `/accessibility` (Rest-Check)
13. [`session-prompt-audit-13-monetarisierung-2026-08-10.md`](session-prompt-audit-13-monetarisierung-2026-08-10.md) — `/monetarisierung`
14. [`session-prompt-audit-14-datenschutz-2026-08-10.md`](session-prompt-audit-14-datenschutz-2026-08-10.md) — `/datenschutz`
15. [`session-prompt-audit-15-vergleich-ui-2026-08-10.md`](session-prompt-audit-15-vergleich-ui-2026-08-10.md) — `/vergleich-ui`
16. [`session-prompt-audit-16-vergleich-technisch-2026-08-10.md`](session-prompt-audit-16-vergleich-technisch-2026-08-10.md) — `/vergleich-technisch`
17. [`session-prompt-audit-17-vergleich-buchhaltung-2026-08-10.md`](session-prompt-audit-17-vergleich-buchhaltung-2026-08-10.md) — `/vergleich-buchhaltung`

## Nach jeder Session

- Fund-Zusammenfassung + Datei-Link hier unter „Ergebnisse" nachtragen.
- Status-Spalte ✅ setzen.
- Kritische/rechtliche Funde zusätzlich in `plan/OFFEN.md` aufnehmen (dort läuft die
  übergreifende Status-Liste).

## Ergebnisse

> **Alle Funde kompakt hintereinander:** [funde-gesamt-2026-08-10.md](funde-gesamt-2026-08-10.md)
> — eine Datei zum Durchlesen und Abarbeiten, wird nach jedem Audit ergänzt.
> Enthält oben die Top-Reihenfolge über alle Audits hinweg.


### #2 Red-Team — ✅ 2026-08-10 · [Funde](funde-audit-01-red-team-2026-08-10.md)

10 Angriffsszenarien durchgespielt, 10 Funde. **Kein Fund erlaubt Zugriff auf fremde Klardaten** —
die serverseitige Zugriffskontrolle (UserID immer aus dem Whop-Token abgeleitet, Redis-/Blob-Keys
daran gebunden, echtes E2E mit lokalem Schlüssel) hält. XSS, CSRF, Callback-Replay, Secret-Exposure
und Supply-Chain sind sauber und nicht ausnutzbar.

Die realen Probleme sind **Umsatz und Betriebskosten**, nicht Datenschutz:

- 🟠 **P1 R1** — Whop-Gate mit einer Konsolenzeile (`App._continueAfterAuth(...)`) umgehbar.
  Architekturbedingt bei Local-First nicht dicht zu bekommen; die Antwort ist Wertverlagerung
  auf die serverseitig gegateten Features, nicht mehr Client-Gate.
- 🟠 **P1 R2** — Ein zahlender Account kann unbegrenzt viele Scopes anlegen → ~200 GB/Tag
  Redis-Belegung. Fehlender Deckel, nicht fehlende Prüfung.
- 🟡 **P2 R3** — Owner-Allowlist prüft den bei Whop **änderbaren Usernamen** statt der
  unveränderlichen `user_`-ID. Drei Dateien, drei Einzeiler. **Bester Aufwand/Nutzen-Fix.**
- 🟡 **P2 R4** — Ein Pro-Abo kann per StB-Grant unbegrenzt Gratis-Zugänge erzeugen.
- 🟡 **P2 R5/R6** — Sync-Key + Token beide in localStorage (Schadensradius bei XSS);
  Blob-Upload ohne Speicher-Quota.
- 🟢 P3 R7-R10 — bewusst nicht zu fixen (Details in der Fund-Datei).

**Empfehlung:** R3 sofort mitnehmen (trivial), R2/R6 als gemeinsamen Redis-Zähler-Block, R4 als
Grant-Deckel. R1 nicht bekämpfen.

### #10 UX-Journey — ✅ 2026-08-10 · [Funde](funde-audit-02-ux-journey-2026-08-10.md)

5 Journeys durchlaufen, 12 Funde. Das Handwerk stimmt (414 Toast-Rückmeldungen, 44-px-Touch-Targets
mit WCAG-Verweis, scrollende Tabellen, 13 Media-Queries) und inhaltlich ist Stackr dem Markt voraus:
Fehlermeldungen liefern die **§-Begründung** mit, der USt-Modus wird als Kartenvergleich mit je vier
Fakten entschieden statt als Dropdown. Alle Schwächen liegen in **den ersten 10 Minuten**.

- 🔴 **U1** — Die Landingpage nennt „7 Tage kostenlos" über 20×, das Gate in `js/whop-auth.js`
  **kein einziges Mal**. Es ist derselbe Whop-Plan (`plan_iR6YIKLcychSZ`), nur anders beschriftet.
  Trifft jeden Wiederkehrer und jeden Local→Web-Wechsler. **Reine Textänderung, größter Hebel.**
- 🔴 **U2** — Kein First-Run-Dashboard: direkt nach 5 Wizard-Schritten sechs 0,00-€-Kacheln,
  zwei leere Charts, null Handlungsvorschläge.
- 🔴 **U3** — Wizard-Schritte 2–5 sind faktisch optional, aber ohne Überspringen-Link und ohne
  jeden Hinweis darauf. Wer die Steuernummer nicht griffbereit hat, bricht ab.
- 🟠 **U5/U6** — §14-Pflichtangaben werden erst **beim Speichern** geprüft, und die Sub-Apps
  (Rechnungen/Eigenbelege/Lager) haben keine Ungespeichert-Warnung — die halbfertige Rechnung
  ist weg. Schmerzhaftester Datenverlust der App.
- 🟠 **U4** — „Rechnung schreiben", die Kernaufgabe, liegt zwei Ebenen tief unter einem
  „Finanzen"-Tab, hinter dem sieben Bereiche stecken.
- 🟠 **U7** — 24 Leerzustände, nur 5 mit `empty-state`-Klasse; „Keine Buchungen **gefunden**"
  liest sich für den Erstnutzer wie eine fehlgeschlagene Suche.
- 🟡 **U8–U12** — Firmenname-Rename beim Zurückgehen, URL/`document.title` beim Navigieren
  (zwei Zeilen in `navigate()`), ELSTER-Export ohne Folgeschritt, Akademie ist reine
  Reselling-Schulung.

**Empfehlung:** U1 und U2 zuerst — beides kleine Eingriffe an der Stelle, wo sich der Trial
entscheidet. Danach U3, dann U5/U6 als Paket.

### #13 Feature-Gap — ✅ 2026-08-10 · [Funde](funde-audit-03-feature-gap-2026-08-10.md)

**Wichtigste Korrektur:** Die Skill-Vorlage führt Bank-Import, E-Rechnung, DATEV, Mahnwesen und
wiederkehrende Rechnungen als offene Deal-Breaker. **Alle fünf existieren im Code** (XRechnung 3.0
CII, CAMT.053 + MT940 + CSV, DATEV-Buchungsstapel SKR03/04, Mahnstufen mit Gebühren,
Auto-Wiederkehrer). Registriert sind **28 Module**, nicht 12.

Die echten Lücken sind zum Teil **architektonisch**, nicht nur Arbeit:

- 🔴 **P0 G3 — Zahlungsabgleich Rechnung ↔ Kontoumsatz.** Bester Aufwand/Nutzen-Posten des
  gesamten Audits. Der Bank-Parser existiert, aber [bank-import.js:410](../js/bank-import.js#L404)
  wirft Einnahmen weg („Einnahme (kein Import)") — genau der häufigste Grund, einen Kontoauszug
  zu importieren. Rein clientseitig lösbar, kein Architekturbruch.
- 🔴 **P0 G1 — ELSTER-Direktübermittlung.** sevDesk und Lexware übermitteln die UStVA per Klick
  **ohne eigenes Zertifikat**; Stackr exportiert nur CSV. Aber: ERiC braucht einen Server, der
  Klartext sieht — das kollidiert mit „100 % lokal". **Empfehlung: nicht bauen, sondern zur
  Haltung machen** + Export-Anleitung (deckt sich mit U11 aus dem UX-Audit).
- 🟠 **P1 G5** — `xrechnung.js` heißt im Kopf „ZUGFeRD", erzeugt aber nur Standalone-XML
  (null Treffer für `PDF/A`, `EmbeddedFile` im ganzen Projekt). Aussage stimmt derzeit nicht.
- 🟠 **P1 G4 OCR** — als **Browser-OCR (Tesseract.js)** die einzige Chance, bei Automatisierung
  aufzuschließen, ohne Local-First aufzugeben. Wäre eine Aussage, die kein Wettbewerber hat.
- 🟠/🟢 G2 PSD2-Bankanbindung, G6 Zahlungslink, G7 Team, G8 native App, G10 lesende API.

**Stärkster Fund fürs Marketing:** Bei Lexware Office kostet E-Rechnung den **XL-Tarif (32,90 €)** —
bei Stackr ist sie für **15 €** drin. Steht heute nirgends auf der Landingpage. Kostet null
Entwicklung.

**Positionierung: Nischen-Fokus.** Nicht gegen sevDesk auf Automatisierung antreten — mit
Local-First nicht zu gewinnen und nicht nötig. Lücke und USP sind **dieselbe Entscheidung**;
entsprechend kommunizieren statt als Rückstand behandeln.

### #1 Security-Delta — ✅ 2026-08-10 · [Funde](funde-audit-04-security-delta-2026-08-10.md)

> **Nachtrag: alle 6 Funde sind inzwischen gefixt.** Eine Parallel-Session hat sie noch am
> 2026-08-10 abgearbeitet (`623ec23`, `5b62268`, `9c395ad`, `5388954`, `35c0cd6`, `cf152e9`),
> am Code nachverifiziert: SheetJS auf **0.20.3**, `_isAllowedKey` für beide Richtungen,
> `kdf.iterations` aus dem Dateiheader mit `ITER_LEGACY`-Fallback, `ITER = 600000`,
> 64-Bit-Fingerabdruck, HKDF mit `v:2`-Versionsfeld. Der Befund unten ist der Auditstand.
> Offen bleibt nur, was einen Whop-Login braucht (Excel-Klickdurch, 2-Account-Fingerabdrucktest,
> Edge-Tastaturtest).

**Es gibt keinen Code-Delta:** HEAD ist unverändert `020a0c5`, seit der Sanierung wurde nichts
committet. Ein reiner Delta-Scan wäre leer gelaufen. Der damalige Review lief ausdrücklich nur
**gegen den Diff** — deshalb stattdessen die vier Flächen geprüft, die in keinem Audit je
vorkamen: **Import-Pfade, Backup-Krypto, StB-Envelope-Krypto, vendorierte Bibliotheken.**
6 neue Funde.

- 🟠 **P1 S2 — SheetJS 0.18.5 mit zwei bekannten CVEs.** `js/vendor/xlsx.full.min.js` ist auf dem
  Excel-Import-Pfad aktiv (app.html + lager/index.html). CVE-2023-30533 (**Prototype Pollution**
  beim Lesen präparierter Dateien, behoben ab 0.19.3) und CVE-2024-22363 (ReDoS, ab 0.20.2).
  Ziel: **≥ 0.20.2 von `cdn.sheetjs.com`** — npm ist unmaintained. Reiner Dateitausch.
- 🟠 **P1 S1 — Backup-Restore schreibt ungefilterte localStorage-Keys.** Der Export ist streng
  allowlisted (`_scopeKeys`), der Import prüft nichts. Weil `_read()` bei nicht-JSON-Werten
  `undefined` liefert, greift die „lokal gewinnt"-Regel ausgerechnet bei `whop_access_token`,
  `whop_grace_token` und `oyi_device_owner_uid` **nicht** — eine präparierte Backup-Datei kann sie
  überschreiben. Backup-Austausch ist in diesem Produkt ein vorgesehener Vorgang (Local→Web, StB).
- 🟡 **P2 S3 — `kdf.iterations` wird in die Datei geschrieben, beim Entschlüsseln aber ignoriert.**
  Latente Datenverlust-Falle: wer `ITER` je hochsetzt, macht **alle Altbackups unlesbar** — mit der
  Meldung „Falsche Passphrase oder beschädigte Datei". Muss **vor** S6 gefixt werden.
- 🟡 **P2 S4 — StB-Public-Key ohne Out-of-Band-Prüfung.** Der Server könnte seinen eigenen Key
  ausliefern und den Envelope entschlüsseln → E2E fällt **für diesen Pfad**. Fix: Fingerabdruck
  beim Einladen anzeigen, oder das schwächere Vertrauensmodell dokumentieren.
- 🟢 P3 S5 (ECDH ohne HKDF), S6 (PBKDF2 210k statt 600k bei SHA-256 — OWASP-Zahlendreher).
- **Nicht ausnutzbar:** XXE (DOMParser löst keine Entities auf), Prototype Pollution im
  Restore-Merge, Fehler-Logger (rein lokal, kein Netzversand, keine Query-Strings).

**Offene Punkte aus dem Memory abgeglichen:**
- ✅ **Local-Spiegelung geklärt: nichts zu spiegeln.** `Local 1.7` hat kein `whop-auth.js`, kein
  `api/`, kein `cloud-sync.js` — es nutzt `license.js` (eigenes Offline-Lizenzmodell). Nebenbefund:
  `Local 1.7/js/app.js:95-103` ruft noch ein nicht existierendes `AuthUI` auf, mit totem
  Supabase-Kommentar. Harmlos (Guard fängt es ab), aber Aufräumkandidat.
- ⏳ **Edge-Tastaturtest bleibt offen** — nur manuell durch dich prüfbar.

### #8 Steuer-Vergleich — ✅ 2026-08-10 · [Funde](funde-audit-05-vergleich-steuer-2026-08-10.md)

Steuerlich ist Stackr **kein Leichtgewicht** — an mehreren Stellen genauer als der Markt. 7 Funde,
davon einer mit echtem Rechenfehler-Potenzial.

- 🔴 **T1 — KSA-Satz ist eine Konstante (`js/ausgaben.js:16`), keine Jahresfunktion.** Für 2026
  stimmen 4,9 % / 1.000 € (recherchiert bestätigt). Aber: **ab 1.1.2027 steigt der Satz wieder auf
  5,0 %** → Stackr rechnet ab dann still zu niedrig. Und rückwärts sind 2025er-Daten schon heute
  falsch (5,0 % / 700 € galten damals). Ironie: dieselbe Codebasis macht es beim §19 vorbildlich
  richtig (`_getUstGrenzen(year)` mit Historie) — das Muster muss nur kopiert werden, ~10 Zeilen.
- 🟠 **T2** — kein GoBD-/IDEA-**Z3-Export** (§147 VI AO). Lexware und sevDesk haben ihn.
  DATEV-Buchungsstapel ist der praktische Ersatz, formal aber nicht gleichwertig.
- 🟠 **T3** — Fristenkalender hat nur 10 feste Termine: **kein Monatsrhythmus** (betrifft die
  wachsenden Nutzer ab 7.500 € USt), keine Dauerfristverlängerung, keine §108-AO-Werktagsverschiebung.
- 🟠 **T4** — Audit-Log-Zeitstempel ist Client-Zeit → Rückdatierung ohne Cloud-Anker unerkannt.
  Der Anker löst es, ist aber opt-in und wird nicht beworben.
- 🟡 T5 (KSA-Bagatellgrenze gilt nicht für „typische Verwerter"), **T6 (Leitweg-ID nur im XML,
  kein UI-Feld → B2G unbenutzbar, obwohl die halbe Arbeit getan ist)**, T7 (kein IDW-PS-880-Testat
  → Wortwahl im Marketing: „GoBD-konform", nie „zertifiziert").

**Was besser ist als der Markt** (steht heute nirgends im Marketing): §19-Prüfung mit historischen
Fassungen + strikter „übersteigt"-Auslegung + 90-%-Vorwarnung · **§14c-Sperre**, die
Kleinunternehmer-Rechnungen mit Steuerausweis aktiv verhindert · §13b/§6a-Trennung (Kz. 41 vs. 21)
· AfA linear/degressiv/GWG vollständig · Audit-Log als Hash-Kette mit externem Anker ·
**Verfahrensdokumentation mitgeliefert** (bei Lexware nur über den StB-Zugang) · KSA **und** KSK.

### #4 UI-Checker — ✅ 2026-08-10 · [Funde](funde-audit-06-ui-checker-2026-08-10.md)

Drei echte Rendering-Bugs, alle aus derselben Ursache: Klasse im JS gesetzt, nirgends definiert.
Jede Behauptung gegen **alle** Quellen geprüft — externe CSS, Inline-`<style>` **und** per JS
injizierte Stylesheets.

- 🔴 **C1 — `.action-btn` (+4 Modifier) ist nirgends definiert**, und `css/style.css` hat auch
  **kein globales `button{}`** als Auffangschirm. Ergebnis: **34 graue Browser-Standardknöpfe**
  in fünf Modulen — Eigenbelege, Rechnungen/Dokumente, Wiederkehrend, GbR, Lager. Die
  beabsichtigte Farbcodierung (Bearbeiten = Akzent, Löschen = Rot) existiert visuell gar nicht.
  **Ein CSS-Block behebt alles.**
- 🟠 **C2 — `.akademie-tip` nirgends definiert** → **43 Merkkästen** (💡 Praxis-Tipp,
  ⚠️ Steuer-Hinweis) rendern als normaler Fließtext, ohne Inline-Styles. In einem Lernmodul ist
  genau diese Hervorhebung der Zweck.
- 🟡 **C3** `.data-table` (15×) undefiniert, aber globales `table{}` fängt es ab — kosmetisch.
- 🟡 **C4** Der Kommentar in `js/app.js:6` sagt „auch in index.html anpassen"; das Versions-Badge
  steht aber in `app.html:188`, und die Landingpage hat gar keins.

**Entwarnung — die Prompt-Annahme war falsch:** Kein Design-System-Drift in den nicht polierten
Modulen. Ein erster Zähllauf sah danach aus (dashboard 23 Hex, rechnung 41, eigenbelege 49 vs.
lager 1), die Einzelprüfung entkräftet es aber vollständig: **ApexCharts-Literale mit korrekter
`isDark`-Verzweigung**, das **Druck-Stylesheet der Rechnung** (muss weiß bleiben, CSS-Variablen
wären dort ein Fehler), **Farbpaletten als Daten** (Kategorie-/Firmenfarben) und
`var(--x,#fallback)`-Fallbacks in den Gate-Overlays. Die Kennzahl taugt hier nicht als Indikator.

Ebenfalls geprüft und sauber: Topnav über alle 4 Seiten · `sidebar-open` einheitlich · NaN-Guards ·
Skript-Pfade + SRI · ESC-Handler überall · kein „TrackYourIncome" · keine Folgeschäden von `020a0c5`.

### #14 Product-Manager — ✅ 2026-08-10 · [Funde](funde-audit-07-product-manager-2026-08-10.md)

Feature-Matrix bewusst **nicht** wiederholt (steht in #13). Hier: Positionierung, Funnel, Preis,
Segment-Reihenfolge. Kernaussage: **Stackr hat ein Positionierungsproblem, kein Produktproblem.**

- 🔴 **P1 — Die kostenlose Local-Version ist ungegated.** `Local 1.7/js/license.js:17` hat
  `PUBLIC_KEY_JWK: null` ⇒ Entwicklermodus, kein Check. Der Modulvergleich zeigt: Local und Web
  trennen **genau 8 Dateien**, davon 3 reine Web-Infrastruktur. Der fachliche Web-Mehrwert sind
  vier Dinge (Cloud-Sync, große Anhänge, StB-Freigabe, Webhooks) — alle 28 Module laufen gratis
  und dauerhaft, CH/AT sogar nur dort. Solange das so ist, wirkt keine andere
  Monetarisierungsmaßnahme. *(Einschränkung: ich sehe nur den Repo-Stand, nicht das Auslieferungs-Build.)*
- 🔴 **P2 — Drei gleichrangige Personas, aber nur zwei haben eigene Module.** Reseller
  (`lager`, `materiallager`, `retouren`, §25a in 8 Dateien) und GbR (`gbr`, `gbr-modul`,
  Gewinnverteilung, Sonderbetriebseinnahmen) sind stark; Freelancer bekommt nur den Standard, den
  jeder Wettbewerber auch hat. **Fair bleibt:** die vier Versprechen der Freelancer-Karte werden
  alle eingelöst — sie beschreiben nur keinen Vorsprung.
- 🟠 **P3** Stundensatz/Zeiterfassung/Projekt: **null Treffer** im Code. Empfehlung: **bewusst
  nicht bauen** — eigenes Produktfeld mit eigener UX-Erwartung; die Energie gehört in Reseller/GbR.
- 🟠 **P4** Ein Preis gegen 6,90–32,90 € gestuften Wettbewerb. Einfachheit behalten, aber mit dem
  Vergleich aus #13 bewerben („E-Rechnung: bei Lexware erst im XL-Tarif für 32,90 €"). Falls doch
  gestuft: nach **Firmenanzahl**, nicht nach Features.
- 🟠 **P5** GbR ist die beste unbesetzte Nische (mehrere Köpfe pro Abo, hoher Leidensdruck,
  Wettbewerb ignoriert sie belegbar) — verdient eine eigene Landingseite mit Rechenbeispiel.
- 🟡 **P6** Akademie startet mit „Was ist Reselling überhaupt?". **Korrigiert meinen U12 aus #10:**
  von 13 Modulen ist gut die Hälfte allgemein — der Fund betrifft nur die *Einstiegsreihenfolge*
  und ist dadurch billiger zu lösen (nach `d.branche` sortieren statt umbenennen).

**Zielkunden-Reihenfolge:** 1. Reseller mit Warenbestand · 2. GbR/Personengesellschaften ·
3. Solo-Selbstständige mit Datenschutz-Anspruch. Nicht gegen sevDesk auf Automatisierung antreten.
Deckt sich mit #13; G3 (Zahlungsabgleich) ist auch aus PM-Sicht Nummer 1, weil es als einziges
Feature **alle drei Segmente** trifft.

### #15 Copy/Marketing — ✅ 2026-08-11 · [Funde](funde-audit-08-copy-marketing-2026-08-10.md)

**Die Copy ist überdurchschnittlich gut.** Headline („Steuern stressen. Stackr beruhigt."),
Tonfall, die dramaturgische Linie der Sektionsüberschriften, 12 FAQ-Einträge und eine
Trial-Kommunikation ohne Dark Pattern — das ist ein Niveau, das man bei einem Ein-Personen-Produkt
selten sieht. Die Schwächen sind **Auslassungen, keine Fehler**.

- 🔴 **M1 — E-Rechnung kommt genau 1× auf der ganzen Landingpage vor**, als Bullet in der
  Preisliste (`index.html:571`). Kein Hero-Bezug, keine Sektion, **kein FAQ-Eintrag** — bei zwölf
  FAQ-Einträgen, die weniger dringende Fragen beantworten. Dabei ist es gesetzliche B2B-Pflicht
  seit 2025 (höchste Suchnachfrage in der Zielgruppe) **und** Stackrs stärkstes Preisargument:
  Lexware liefert E-Rechnung erst im XL-Tarif für 32,90 €. **Teuerste Auslassung der Seite.**
- 🔴 **M2 — kein einziger Sozialbeweis.** Keine Stimmen, keine Nutzerzahlen, keine Siegel.
  Bei einem unbekannten Anbieter, dem man die Buchhaltung anvertrauen soll, ist das die stillste
  Kaufbremse. Empfehlung: echte Zahlen (28 Module, 200+ Tests) oder **ein** echtes Zitat —
  nichts erfinden (§5 UWG, und diese Zielgruppe prüft).
- 🟠 **M3** — Die Gratis-Offline-Version wird nicht erwähnt; die FAQ **verneint** sie sogar
  („kein Download, keine Installation", `index.html:642`). Zusammen mit **P1** (Local ist
  ungegated) ist sie damit weder Funnel noch Produkt. Erst Produktentscheidung, dann Text.
- 🟠 **M4** — Kein direkter Wettbewerbs-Preisanker. Der vorhandene („eine
  Steuerberater-Stunde kostet 150–250 €") ist stark, aber indirekt.
- 🟡 **M5** Hero nennt die Zielgruppe nicht (der `<title>` macht es vorbildlich) ·
  🟡 **M6** drei Persona-CTAs führen alle auf denselben generischen Checkout.

**Während des Audits erledigt:** U1 aus #10 — `js/whop-auth.js` nennt den Trial jetzt 8×.

**Top-3 Quick Wins:** E-Rechnungs-FAQ + Preiszeile (~20 Min) · Wettbewerbs-Preisanker (~15 Min) ·
Zielgruppen-Kicker über der Headline (1 Zeile).

### #3 Performance — ✅ 2026-08-11 · [Funde](funde-audit-09-performance-2026-08-10.md)

Größen **gemessen**, nicht geschätzt. **Der Session-Prompt hatte recht mit dem Misstrauen:**
Die Defer-Optimierung wurde nur auf `app.html` angewendet — die drei Sub-Apps laden praktisch
alles render-blockierend.

| Seite | Scripts | defer | blockierend |
|---|---|---|---|
| `app.html` | 67 | 63 | ~4 ✅ |
| `rechnungen/` | 32 | 1 | **~31** |
| `eigenbelege/` | 22 | 1 | **~21** |
| `lager/` | 21 | 1 | **~20** |

- 🔴 **F1** — `eigenbelege/index.html:19-22` lädt Chart.js, **ApexCharts (~600 KB)**, GSAP und
  Notyf **im `<head>` ohne `defer`**. `rechnungen/` hat 31 blockierende Tags (678 KB lokal +
  ~735 KB CDN). Bitter dabei: `js/dashboard.js` lädt ApexCharts vorbildlich **lazy** — die
  Sub-Apps ziehen dieselbe Bibliothek eager. Fix Stufe 1 ist reine Attribut-Ergänzung.
- 🔴 **F2** — **`xlsx.full.min.js` = 929 KB**, größte Datei des Projekts, lädt bei **jedem**
  App-Start; gebraucht nur beim Excel-Import, den die meisten nie auslösen.
- 🟠 **F3** — `chart.min.js` (200 KB) nur für `statistiken.js`, auf `eigenbelege/` geladen aber
  dort **ungenutzt**. Zwei Chart-Bibliotheken parallel (~800 KB).
- 🔴 **F6** — Cloud-Sync überträgt immer den kompletten Blob, AES-GCM im Main-Thread.
  **Empfehlung: kein Delta-Sync bauen** (CAS/Merge sind korrekt und getestet) — stattdessen
  Web Worker + sichtbare Rückmeldung.
- 🟢 F4 (kein `preload` für Font/CSS/app.js) · F5 (Tabellen per `innerHTML`, aber
  Event-Delegation fängt es ab — nicht überstürzen) · F7 (`setInterval` ohne clear).

**Gemessen:** 2.897 KB lokales JS in `app.html`, davon 1.129 KB Vendor · CSS 72 KB.

**Geprüft und gut:** In-Memory-Store statt localStorage-Reads pro Render · `destroy()` an sechs
Stellen vor jedem Chart-Neu-Render · **Event-Delegation** (ein Handler für 350 `data-action`,
null Listener in Render-Schleifen) · self-hosted Variable Fonts mit `font-display: swap` ·
Landing-CSS sauber von der App getrennt · SRI + preconnect.

**Top-5 Quick Wins:** `defer` an Sub-Apps · xlsx lazy · ApexCharts lazy in Sub-Apps ·
`chart.min.js` aus eigenbelege löschen · preload für Font/CSS/app.js — Punkte 1, 4 und 5
zusammen unter einer Stunde, nur Markup. Gegenprobe: Lighthouse auf `app.html` **und**
`rechnungen/index.html`, die Differenz ist genau der F1-Effekt.

### #5 Steuer-Delta — ✅ 2026-08-11 · [Funde](funde-audit-10-steuern-delta-2026-08-10.md)

Nur Neues seit dem Juli-Audit geprüft. **Die Teilzahlung ist steuerlich sauber gebaut** —
§11 EStG Zuflussprinzip explizit umgesetzt, Doppelzählung bei der Schlusszahlung aktiv verhindert
(satzgenau, mit `!s.storniert`-Filter), §17 UStG bei Gutschriften, §14-Sperre bewusst und
begründet umgangen. Zwei Funde, beide vom selben Typ: **eine Schutzmaßnahme greift an der
falschen Stelle oder gar nicht.**

- 🔴 **D2 — Lager-Massenoperationen umgehen das GoBD-Audit-Log.** `js/store.js` protokolliert
  vorbildlich (42 `_addAuditEntry`-Aufrufe, Vorher/Nachher, Hash-Kette) — aber `lager/page.js`
  schreibt an fünf Stellen direkt über `Store.setAsync('purchases'|'sales', …)`
  (Zeilen 1627, 2015-2016, 2454, 2465), und `setAsync` ist ein reiner Schreibpfad **ohne**
  Protokolleintrag. Betroffen sind Batch-Import und Massen-Statuswechsel — also Wareneinkäufe
  **und** Betriebseinnahmen. §146 Abs. 4 AO / GoBD Rz. 64. In einer Prüfung fällt genau das auf:
  Das Protokoll wirkt vollständig (Kette intakt), zeigt aber die umsatzstärksten Vorgänge nicht.
  **Fix klein:** `_addAuditEntriesBatch()` (store.js:1089) liegt fertig daneben.
- 🟠 **D1 — Teilzahlung bei gemischten Steuersätzen wird grundlos blockiert.**
  `rechnungen/js/dokumente.js:28-31` lehnt 7 %+19 %-Rechnungen ab mit der Begründung, der Store
  könne nur einen Satz mitgeben. **Das stimmt nicht mehr:** `createSaleFromInvoice()` teilt
  proportional auf (`sale.steuersaetze`), und `js/ustvoranmeldung.js:58,68-71` liest es korrekt.
  Die Sperre ist ein Relikt — und ihr Rat „bitte Schlusszahlung abwarten" verursacht genau den
  **§11-EStG-Fehler**, den der Zufluss-Sale ausweislich seines eigenen Kommentars verhindern soll
  (Dezember-Zahlung landet erst im Januar). Betrifft typische Reseller-Rechnungen.

**§25a:** 7 %-Lücke bei Anlage-2-Fällen unverändert offen, bewusst zurückgestellt (OFFEN.md 2.1).
**Lager/EÜR:** korrekt **keine** Bestandsbewertung in der EÜR — §4 Abs. 3 EStG kennt sie nicht,
der Lagerwert wird nur informativ angezeigt.

**Reihenfolge:** D2 zuerst (einziger Fund mit Prüfungsrisiko, kleiner Fix), dann D1 mit Testfall.

### #6 Compliance/Legal — ✅ 2026-08-12 · [Funde](funde-audit-11-compliance-legal-2026-08-10.md)

Die Rechtstexte sind **auffällig gründlich** — Impressum mit EuGH-C-298/07-Begründung für die
reine E-Mail-Erreichbarkeit, Datenschutz mit allen vier Auftragsverarbeitern und Art. 46 für die
USA-Übermittlung, AGB mit §312j-Buttonlösung, §356a und §7-UWG-Hinweis. **Ein Fund sticht heraus.**

- 🔴 **L1 — In der App laufen zwei völlig verschiedene AGB-Fassungen nebeneinander.**
  `agb.html` hat 11 §§ (Whop als Merchant of Record, Widerrufsrecht, Preise, Zahlung); die beiden
  In-App-Modale (`js/app.js:927`, `rechnungen/js/app.js:227`, textgleich) haben 8 §§ **ohne
  Widerruf, ohne Preise, ohne Whop** — erkennbar der Stand vor der Whop-Migration. Das Modal
  erscheint **nach** dem Vertragsschluss beim Whop-Checkout und blockiert bei Ablehnung die
  Nutzung. Rechtlich dreifach heikel: keine wirksame Einbeziehung (§305 II BGB), Unklarheitenregel
  zulasten des Verwenders (§305c II) — was ausgerechnet den **Haftungsausschluss entwertet**, der
  der Zweck des Modals ist — und Verletzung des Transparenzgebots (§307 I 2).
  **Fix ist Textarbeit:** Modal auf eine Kurzfassung mit Link auf `agb.html` umstellen.
- 🟠 **L3** — Die AGB sind **aus der App heraus nicht verlinkt**: alle vier App-Seiten führen
  nur Impressum und Datenschutz (§312i I Nr. 4 BGB). Vier Einzeiler im Footer.
- 🟠 **L2** — `agb_accepted` speichert einen Zeitstempel statt einer Version → eine
  AGB-Änderung erreicht **keinen** Bestandsnutzer mehr; §9 der eigenen AGB ist so nicht umsetzbar.
- 🟠 **L5/L6** — Whop-DPA offen (zusätzlich Upstash und Vercel prüfen), Anwalts-Freigabe
  §11 + §356a offen. Der AGB-Text weist auf Letzteres **selbst** hin — ehrlich, aber vor dem Launch
  durch die echte Prüfung zu ersetzen.
- 🟢 **L4** — Der Banner sagt „Cookies", tatsächlich ist es localStorage.

**Geprüft und korrekt:** DDG §5 vollständig inkl. §36 VSBG · Art. 13 DSGVO mit Whop, Upstash,
Vercel, Cloudflare, jsDelivr, Make.com · **Cookie-Banner ohne Ablehnen-Button ist hier richtig**
(nur technisch notwendige Speicherung, §25 II Nr. 2 TDDDG — ein Ablehnen-Button wäre irreführend) ·
§5 StBerG-Disclaimer an drei Stellen, dazu positioniert die Landingpage aktiv **für** den
Steuerberater statt gegen ihn · E-Rechnung im UI präsent, inkl. §14b-Aufbewahrungshinweis genau im
Import-Ergebnis · Linkhaftung + `rel="noopener"`.

### #9 Accessibility — ✅ 2026-08-12 · [Funde](funde-audit-12-accessibility-2026-08-10.md)

Kontraste **berechnet**, nicht geschätzt. **Das Farbsystem besteht 45 von 45 Paarungen mit AA**
(schwächster Wert 4,64:1), viele sogar AAA — bei einem Dark-Theme selten, hier wurde offensichtlich
gerechnet statt nach Gefühl gewählt. Zwei echte Verstöße, beide genau dort, wo der Session-Prompt
sie vermutet hat.

- 🔴 **A1 — Die Akademie ist per Tastatur komplett unbedienbar** (WCAG 2.1.1 + 4.1.2, **Level A**).
  `js/akademie.js` hat **null** Treffer für `aria-`, `role=` oder `tabindex`. Modulkarten,
  Lektionszeilen und der Weiterlesen-Banner sind `<div>` mit `cursor:pointer` und ausschließlich
  `click`-Handlern — `keydown`: 0 Treffer. Ein Tastatur- oder Screenreader-Nutzer kann **kein
  einziges Modul öffnen**; das ganze Modul fällt für ihn aus. Fix: `role="button"` +
  `tabindex="0"` + Enter/Space-Handler, ~30 Minuten.
- 🟠 **A2 — Eingabefelder ohne erkennbare Abgrenzung** (1.4.11, **AA**). Rand
  **1,47:1** statt 3:1 — und der übliche Ausweg greift nicht: die Feldfüllung hebt sich mit
  **1,09:1** gegen die Karte praktisch nicht ab. Weder Rand noch Füllung zeigen, wo ein Feld ist.
  Fix: eigene `--border-field` mit 3:1, damit die dezenten Trennlinien im Rest der Oberfläche
  ihre Wirkung behalten.
- 🟠 **A3** Lager: 11 klickbare `<div>`/`<tr>` ohne Tastaturpfad — abgeschwächt, weil die
  Tabellenzeile eine echte Checkbox als Ersatzweg hat; die Foto-Kachel nicht.
- 🟡 **A4** kein Skip-Link · **A5** `<nav>`/`<main>` ohne `aria-label` bei **zwei** Navigationen.

**Geprüft und korrekt:** 2.4.7 Fokus sichtbar — alle drei `outline:none` haben Ersatz, und der
Randwechsel auf `--accent` trägt mit **7,54:1** (der Glow allein wäre mit 10 % Deckkraft zu schwach) ·
**3.1.1** Sprachattribut wird bei i18n-Umschaltung gesetzt · **4.1.3** Live-Region für die 414 Toasts ·
**Label-Verknüpfung läuft automatisch** per MutationObserver — damit beantwortet sich die Frage des
Prompts, ob neue Formulare sie nutzen: sie brauchen nichts zu tun · Fokus-Falle in den Gate-Overlays ·
2.5.5 Touch-Targets · `<th scope>` · ESC überall.

**Nicht automatisierbar:** Edge-Tastaturtest (Logik geprüft, Wahrnehmung nicht) · Farbblindheit in
den ApexCharts — in Tabellen durch `+`/`−` und Text-Badges entschärft, in den Charts trägt allein
die Farbe.

### #12 Monetarisierung — ✅ 2026-08-13 · [Funde](funde-audit-13-monetarisierung-2026-08-10.md)

**Skill-Prämisse überholt:** Der Skill baut seine Funnel-Analyse auf „Local 1.7 als wichtigster
Top-of-Funnel" — Local ist seit 2026-08-11 eingestellt. Zwei Skill-Abschnitte fallen damit weg;
die eigentliche Frage ist eine andere (N1).

- 🔴 **N2 — Der Trial ist in der App unsichtbar, obwohl der Server ihn kennt.**
  `api/whop-access.js:100` prüft ausdrücklich `status === 'trialing'`, die Antwort an den Client
  (Z. 216) wirft es weg. `isTrialActive()` und `getTrialDaysLeft()` sind Stummel (`false`/`null`).
  Während der 7 Tage gibt es **keinen Countdown und keine Vorwarnung vor der Abbuchung** — das
  Kontomenü zeigt stattdessen „Pro aktiv". Zwei Folgen: **Rückbuchungsrisiko** (vergessener Trial
  → Überraschungsbuchung → Chargeback, teuer und schädigt den Whop-Standing) und der beste
  Conversion-Moment (Tag 5–6, wenn der Wert sichtbar ist) bleibt ungenutzt. Verkabelung fehlt,
  nicht Logik — ~1 Tag.
- 🟠 **N3** — Der Preisumschalter startet auf „Monatlich", obwohl das Jahresabo 25 %
  günstiger ist und den Cashflow vorzieht. Das **Gate macht es bereits richtig** (Jahreskarte
  hervorgehoben, „SPAR 45 €", 11,25 €/Monat) — nur die Landingpage nicht. ~1 Stunde.
- 🟠 **N4** — Keine Erinnerung vor der Jahresverlängerung. Der Winback-Screen ist gut gemacht
  (beide Preise, gerechnete Ersparnis, „Deine Daten bleiben lokal gespeichert" — das stärkste
  Argument einer Local-First-App), erreicht aber **nur Rückkehrer**. Fix: zwei Mails im
  Whop-Backend, kein Code.
- 🟡 **N1** — **Kein Top-of-Funnel mehr:** nur Landing → Checkout **mit Kartenpflicht**,
  die höchste Hürde im Vergleichsfeld (sevDesk/Lexware: Testphase; FastBill/Papierkram: Free-Tier).
  Empfehlung: **Demo aufwerten** statt Free-Tier bauen — sie existiert bereits und ist die richtige
  Antwort auf ein Hard-Gate.
- 🟡 **N5** — Ein Preis für sehr unterschiedliche Intensität; StB-Zugang und
  Empfehlungsprogramm sind **fertig gebaut und ungenutzt**.

**Korrektur einer älteren Notiz:** Der Referral-Rechtstext ist **nicht** mehr offen — `agb.html`
§11 mit Anker `#empfehlungsprogramm` existiert und ist korrekt verlinkt. Auch die Whop-Plan-Links
sind echt, keine Platzhalter.

**Bewusst kein Fund:** Es gibt **kein Churn-Tracking im Produkt** — und das soll so bleiben. Ein
Local-First-Produkt mit E2E darf kein Nutzungsverhalten messen, ohne sein eigenes Versprechen zu
brechen. Die nötigen Kennzahlen (Trial-Konversion, Kündigungsquote, Plan-Verteilung) liefert Whop.

### #11 UI-Vergleich — ✅ 2026-08-13 · [Funde](funde-audit-15-vergleich-ui-2026-08-10.md)

**Bewusst kurz gehalten:** Sieben der zehn Skill-Dimensionen (Onboarding, Navigation, Formulare,
Feedback, Design-System, Accessibility, Ladeverhalten, Landing) sind in #10, #4, #9, #3 und #15
bereits am Code belegt und werden nicht wiederholt. Neu ist die Markteinordnung.

**✅ Der überraschende Befund: Dark/Light-Mode ist vollständig — und im Vergleichsfeld einzigartig.**
44 Tokens im `:root`, **32 davon** im Light-Block überschrieben; die übrigen zwölf sind ausnahmslos
nicht-farbig (Radien, Fonts, Easing, Maße) und dürfen gar nicht wechseln. Das Detail, das Qualität
verrät: **`--surface-2` wird von `rgba(255,255,255,.05)` auf `rgba(0,0,0,.04)` umgekehrt** statt nur
mitgeschleift — genau das wird bei nachgerüsteten Light-Modes vergessen. Auch die Charts folgen dem
Theme (`dashboard.js:454-478`). Zu **Dark Mode bei sevDesk, Lexware Office und FastBill ließ sich
nichts finden**, obwohl Oberfläche und Bedienung sonst ausführlich verglichen werden.

- 🟠 **V1** — Der Theme-Umschalter **existiert, ist aber `display:none`** (`app.html:65`,
  Kommentar in `style.css:723`). Wer ein helles System fährt — im Büro die Regel — sieht die Marke
  nie so, wie sie gedacht ist. Fix: 3-Zustands-Umschalter; **Achtung**, `isDark` in
  `dashboard.js:454` liest heute nur `matchMedia` und muss die manuelle Wahl mitlesen.
- 🟠 **V2** — Keine native App **und kein PWA-Manifest**, während sevDesk laut Vergleichstests
  2026 mit „der besten App im Test" Testsieger wurde (Note 1,1). „Die App" ist dort ein eigenes
  Bewertungskriterium — Stackr verliert Punkte in einer Kategorie, in der es gar nicht antritt.
  Billiger Zwischenschritt: PWA-Manifest + Icons, ~2 h; Grundlage (44-px-Targets, 13 Media-Queries)
  stimmt bereits.
- 🟡 **V3** — Dark Mode und Design-System stehen nirgends auf der Landingpage. Gleiches Muster
  wie M1: vorhandene Stärken werden nicht erzählt.

**Score:** Stackr **6,8** · sevDesk 8,2 · FastBill 7,2 · Lexware Office 6,6. Stärken Dark Mode 9 und
Design-System 8; Schwächen Onboarding 5 und Mobile 6. Aufschlussreich: **Lexware Office wird
umgekehrt als „für Solo-Selbstständige etwas überladen" kritisiert** — Stackrs Problem ist zu viel
Pflicht im Onboarding, deren Problem zu viel Angebot.

### #16 + #17 Technischer und buchhalterischer Vergleich — ✅ 2026-08-13 · [Funde](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md)

Auf Wunsch **in einem Lauf**. Beide Prio „Niedrig", beide mit starker Überschneidung zu #13 und #8 —
die Feature- und Compliance-Matrizen wurden nicht wiederholt.

**Neue Funde: keine.** Das ist das eigentliche Ergebnis — zwei zusätzliche Vergleichsläufe
fördern nichts zutage, was nicht schon erfasst war. Die vorherigen Audits waren vollständig genug.

**Technik:** Kein Build-Schritt ist eine **dokumentierte Entscheidung** (`package.json`: „Kein
Build-Schritt für die statische Seite", **eine einzige** Produktiv-Abhängigkeit). Das zahlt auf
drei Dinge ein, die kein Cloud-Wettbewerber bieten kann: Prüfbarkeit des Auslieferungsstands,
minimale Lieferketten-Fläche, keine Build-Fäulnis. Preis: 2.897 KB unkomprimiert. **Der
Wechselpunkt ist definierbar** — ein Build lohnt erst, wenn der Anwendungscode deutlich wächst
oder die zwei parallelen Chart-Bibliotheken (~800 KB) angegangen werden; vorher bringt F2 mehr.
Starkes Gegengewicht zum Tech-Debt: **32 Node-Test-Harnesses** — der Grund, warum die vielen
Steuer-Fixes dieser Runde ohne Regressionen durchgingen.

**Buchhaltung:** Der DATEV-Export ist ernster gemeint als erwartet — nicht nur Pflichtspalten,
sondern **BU-Schlüssel, Festschreibung, Beleglink, EU-Steuersatz, Beteiligtennummer**, dazu
SKR03 **und** SKR04. Die 30 Eigenbeleg-Kategorien sind zielgruppengenau geschnitten (Wareneinkauf
unterteilt in Privatkauf/Flohmarkt/Großhändler/Online-Marktplatz — entscheidend für §25a).
Mahnfristen sind Daten, nicht Fließtext.

**Beide Vergleiche kommen unabhängig auf denselben Befund:** Stackr verliert dort, wo
Automatisierung einen Server mit Klartextzugriff braucht (OCR, PSD2, ELSTER, automatischer
Mahnungsversand) — und gewinnt dort, wo Tiefe statt Breite zählt (Lager + §25a, GbR, Kategorien,
DATEV-Tiefe). **Die einzige verbliebene Lücke, die weder gesetzlich erzwungen noch
architekturbedingt blockiert ist, ist OCR** — und dafür liegt als G4 bereits eine Spezifikation
inkl. CSP-Freigabe vor (Commit 9567630).
