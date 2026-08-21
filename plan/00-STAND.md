# Stackr Web 1.7 — Gesamtstand

**Stand: 2026-08-14**, gegen den Code verifiziert (nicht aus älteren Plandateien übernommen).
Diese Datei ist der **Einstiegspunkt**. Sie sagt, wo das Projekt steht und wo was liegt.

---

## In 60 Sekunden

- **Nur `Web 1.7` wird gepflegt.** `Local 1.7` ist seit 2026-08-11 eingestellt (Entscheidung des
  Users). Ordner bleibt liegen, wird **nicht mehr gespiegelt**. Jede ältere Notiz, die eine
  „Local-Spiegelung" als Aufgabe führt, ist gegenstandslos.
  **Ausnahme:** der Local-**Import** in Web (`js/backup-crypto.js`) bleibt als Migrationspfad für
  Bestandsdaten und muss funktionsfähig bleiben.
- **Ein Vollaudit über 17 Themen ist abgeschlossen** (2026-08-10 bis 08-13), rund 70 Funde.
  Der weitaus größte Teil ist bereits gefixt.
- **Was noch offen ist, steht in [`01-AUFGABEN.md`](01-AUFGABEN.md)** — nach Zuständigkeit
  getrennt, jeder Punkt mit Datei, Zeile und fertigem Fix.
- **Was bewusst *nicht* geändert wird, steht in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).**
  Vor jedem neuen Audit lesen — sonst werden dieselben Dinge erneut als Fund gemeldet.
- **Dieses Repo wird von mehreren Sessions gleichzeitig bearbeitet.** Das ist der Normalzustand,
  kein Sonderfall. Regeln in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md) — **vor dem ersten
  Commit lesen.**
- **Erste Amtshandlung immer:** `git status` und `git log --oneline -5`. Diese Datei kann eine
  Viertelstunde nach dem Schreiben an einer Stelle überholt sein.

---

## Was Stackr ist

Buchhaltung für Selbstständige, mit Schwerpunkt auf **Reseller mit Warenbestand** und **GbR**.
Local-First: die Buchhaltungsdaten liegen in `localStorage`/`IndexedDB` auf dem Gerät des
Nutzers. Cloud-Sync ist optional und speichert ausschließlich Chiffrat — der Schlüssel verlässt
das Gerät nie.

| | |
|---|---|
| Auth + Zahlung | **Whop** (Merchant of Record, US, SCC). Kein Supabase, kein Paddle. |
| Preis | 15 €/Monat · 135 €/Jahr (inkl. MwSt.), **7-Tage-Trial mit Kartenpflicht** |
| Zugang | Hard-Gate `AuthUI.boot()`, kein Free-Tier im Web |
| Architektur | Vanilla JS, **kein Build-Schritt**, 1 Produktiv-Abhängigkeit (`@vercel/blob`) |
| Umfang | 28 registrierte Module + 3 Sub-Apps (Rechnungen, Lager, Eigenbelege) |
| Serverless | 5 Endpunkte in `api/` |
| Tests | 32 Node-Harnesses in `test/`, cache-immun |
| Hosting | Vercel; Cloud-Sync über Upstash Redis (Frankfurt) + Vercel Blob |

---

## Das Vollaudit 2026-08 — 17 Themen, alle abgeschlossen

| # | Thema | Funde | Kernbefund |
|---|---|---|---|
| 01 | [Red-Team](funde-audit-01-red-team-2026-08-10.md) | 10 | Kein Zugriff auf fremde Klardaten möglich. Probleme sind Umsatz und Betriebskosten, nicht Datenschutz |
| 02 | [UX-Journey](funde-audit-02-ux-journey-2026-08-10.md) | 12 | Handwerk stark; alle Schwächen in den **ersten 10 Minuten** |
| 03 | [Feature-Gap](funde-audit-03-feature-gap-2026-08-10.md) | 10 | Bank-Import, E-Rechnung, DATEV, Mahnwesen existieren **alle** — 28 Module, nicht 12 |
| 04 | [Security-Delta](funde-audit-04-security-delta-2026-08-10.md) | 6 | ✅ vollständig gefixt (SheetJS-CVEs, Backup-Restore-Allowlist) |
| 05 | [Steuer-Vergleich](funde-audit-05-vergleich-steuer-2026-08-10.md) | 7 | Steuerlich an mehreren Stellen **genauer als der Markt** |
| 06 | [UI-Checker](funde-audit-06-ui-checker-2026-08-10.md) | 4 | ✅ **alle vier zu** (Stand 2026-08-16): `.action-btn`, `.akademie-tip` und `.data-table` sind definiert, der Versions-Kommentar zeigt auf `app.html`. **Kein** Design-System-Drift |
| 07 | [Product-Manager](funde-audit-07-product-manager-2026-08-10.md) | 6 | Positionierungsproblem, kein Produktproblem |
| 08 | [Copy/Marketing](funde-audit-08-copy-marketing-2026-08-10.md) | 6 | Copy überdurchschnittlich; Schwächen sind **Auslassungen** |
| 09 | [Performance](funde-audit-09-performance-2026-08-10.md) | 7 | Defer-Optimierung war nur auf `app.html` angewendet |
| 10 | [Steuer-Delta](funde-audit-10-steuern-delta-2026-08-10.md) | 2 | ✅ gefixt. Teilzahlung war steuerlich sauber gebaut |
| 11 | [Compliance/Legal](funde-audit-11-compliance-legal-2026-08-10.md) | 6 | Zwei widersprüchliche AGB-Fassungen (✅ gefixt) |
| 12 | [Accessibility](funde-audit-12-accessibility-2026-08-10.md) | 5 | **45 von 45 Farbpaarungen erfüllen AA** |
| 13 | [Monetarisierung](funde-audit-13-monetarisierung-2026-08-10.md) | 5 | Trial war in der App unsichtbar (✅ gefixt) |
| 14 | [Datenschutz](funde-audit-14-datenschutz-2026-08-10.md) | 10 | Analytics lud ungefragt; Drittanbieter-Ladungen |
| 15 | [UI-Vergleich](funde-audit-15-vergleich-ui-2026-08-10.md) | 3 | Dark/Light-Mode **vollständig — im Vergleichsfeld einzigartig** |
| 16+17 | [Technik + Buchhaltung](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md) | 0 | **Keine neuen Funde** — vorherige Audits waren vollständig |

**Sammelübersicht aller Funde am Stück:** [`funde-gesamt-2026-08-10.md`](funde-gesamt-2026-08-10.md)

---

## Was das Audit über das Produkt ergeben hat

### Stärken, die belegbar über dem Marktniveau liegen

Diese Punkte sind am Code verifiziert und **gehören ins Marketing** — dort stehen sie heute nicht:

1. **E-Rechnung im Basispreis.** Bei Lexware Office erst im XL-Tarif für **32,90 €**, bei Stackr
   für 15 € enthalten. Stärkste einzelne Verkaufsaussage aus dem gesamten Audit.
2. **§14c-Sperre.** Die App verhindert aktiv, dass eine Kleinunternehmer-Rechnung je einen
   Steuerbetrag ausweist — genau der Fehler, bei dem man die Steuer nach §14c Abs. 1 UStG
   schuldet. Wettbewerber warnen dort nicht, sie lassen es zu.
3. **§19-Grenzprüfung mit historischen Fassungen**, strikter „übersteigt"-Auslegung und
   90-%-Vorwarnung.
4. **Audit-Log als Hash-Kette** mit externem Cloud-Anker (GoBD Rz. 64).
5. **Verfahrensdokumentation mitgeliefert** — bei Lexware nur über den Steuerberater-Zugang.
6. **Dark/Light-Mode vollständig**; im Vergleichsfeld ließ sich zu Dark Mode bei sevDesk,
   Lexware und FastBill **nichts** finden.
7. **45 von 45 Farbpaarungen erfüllen WCAG AA** — bei einem Dark-Theme selten.
8. **Fehlermeldungen mit Rechtsgrund** („§14 UStG Pflichtangabe" statt „Feld ungültig").
9. **Lager + §25a-Differenzbesteuerung + GbR-Gewinnverteilung** — im Vergleichsfeld konkurrenzlos.

### Schwächen, die strukturell sind

- **Automatisierung braucht einen Server mit Klartextzugriff** — OCR, PSD2-Bankanbindung,
  ELSTER-Übermittlung, automatischer Mahnungsversand. Das ist die Kehrseite der
  Architekturentscheidung, kein Rückstand. Siehe [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).
- **Drei beworbene Zielgruppen, zwei wirklich bediente.** Reseller und GbR haben eigene Module,
  Freelancer bekommt nur den Standard.
- **Kein Top-of-Funnel mehr**, seit Local eingestellt ist: nur Landing → Checkout **mit
  Kartenpflicht**, die höchste Hürde im Vergleichsfeld.

---

## Wo was liegt

| Datei | Inhalt |
|---|---|
| `plan/00-STAND.md` | **diese Datei** — Einstieg und Gesamtbild |
| `plan/01-AUFGABEN.md` | Was noch zu tun ist, nach Zuständigkeit getrennt |
| `plan/02-ENTSCHEIDUNGEN.md` | Was bewusst **nicht** geändert wird, mit Begründung |
| `plan/03-ARBEITSREGELN.md` | Parallele Sessions, Fallen, Verifikationswege |
| `plan/funde-gesamt-2026-08-10.md` | Alle Audit-Funde am Stück, eine Zeile je Fund |
| `plan/funde-audit-01…17-*.md` | Die einzelnen Audits mit Datei:Zeile je Fund |
| `plan/OFFEN.md` | ältere Statusliste — **von `01-AUFGABEN.md` abgelöst**, nur noch Archiv |
| `plan/uebergabe-2026-08-12.md` | Übergabe vom 12.08. — **von diesen vier Dateien abgelöst** |
| `plan/PLAN.md` | Archiv der Prompt-Texte. **Nicht als Arbeitsliste benutzen** — enthält viel Erledigtes ohne Markierung |
| `test/` | 32 Node-Harnesses, cache-immun, gute Vorlage für neue Rechen-Tests |
