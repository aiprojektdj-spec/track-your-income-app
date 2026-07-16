# Launch-Prompts — Web 1.7 (Stand 2026-07-12)

Copy-paste-Prompts für alles, was vor dem Web-Launch noch offen ist.
Reihenfolge = Priorität. P0 = Launch-Blocker, P1 = launch-nah, P2 = kann nach Launch.

Jeder Prompt ist self-contained für eine frische Session gedacht.

---

## P0-1 · Uncommittete Trial-CTA-Änderungen verifizieren + committen — ✅ ERLEDIGT 2026-07-12 (Commits 655f428 + 25fcf6b; Session-CTA-Bugfix in landing.js, AGB-Vorschlag → plan/anwalt-notiz-trial-widerruf.md)

```
Im Repo Web 1.7 liegen uncommittete Änderungen an index.html und js/landing.js:
Die Pricing-CTAs wurden auf „Jetzt 7 Tage kostenlos testen →" umgestellt und
verlinken jetzt direkt auf die Whop-Checkout-Plan-Links
(plan_iR6YIKLcychSZ monatlich, plan_b5IBQ1lecggOT jährlich).

Aufgaben:
1. Lies den kompletten Diff (git diff index.html js/landing.js) und prüfe ihn auf
   Konsistenz: Stimmen beide Plan-Links? Ist der Monats/Jahres-Toggle weiter korrekt
   (11,25 €/Monat jährlich = 135 €, 15 €/Monat monatlich, inkl. MwSt.)?
2. Verifiziere im Browser (Preview-Server oder Edge — nie Chrome): Toggle umschalten,
   CTA-Text und href in beiden Zuständen prüfen, Konsole auf Fehler.
3. Prüfe, ob plan/trial-agb-diff-vorschlag.md noch gebraucht wird — die AGB/Widerruf-
   Trial-Anpassung wurde bereits committet (78ff1d5). Wenn der Vorschlag vollständig
   umgesetzt ist, verschiebe die offene Anwalts-Warnung (§ 356 Abs. 5 BGB, vorzeitiges
   Erlöschen des Widerrufsrechts) in eine kurze Notiz und lösche/archiviere die Datei.
4. Committe die Landing-Änderungen mit sauberer Message. NICHT deployen — macht der User.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im Ordner. Vor jedem
Edit die Datei frisch lesen; nur die eigenen Dateien stagen.

Akzeptanz: Diff verifiziert im Browser, committet, keine fremden Änderungen mitcommittet,
Status von trial-agb-diff-vorschlag.md geklärt.
```

---

## P0-2 · USt-Regelbesteuerung im Browser verifizieren (bisher ungetestet!) — ✅ ERLEDIGT 2026-07-13 (alle 5 Features browserverifiziert; 14 Bugs gefixt in 6c3220a + ecdfeee, u. a. RC-Automatik tot auf Standalone-Seite, Phantom-Vorsteuer, Retouren-Doppelabzug, DATEV verschluckte Direktverkäufe; Restliste → plan/ust-befunde-restliste.md, größter offener Punkt: Gutschriften mindern Umsatz nicht)

```
Im Repo Web 1.7 wurden am 2026-07-02 USt-Regelbesteuerungs-Features gebaut, die wegen
des Whop-Gates NIE im Browser getestet wurden: Soll/Ist-Versteuerungs-Schalter,
§14-UStG-Pflichtangaben-Sperre bei Rechnungen, Reverse-Charge-Automatik,
SKR-Konto-Badges und ein neues OSS-Modul.

Aufgaben:
1. Finde die betroffenen Module (grep nach Soll/Ist, Reverse-Charge, OSS, §14) und
   verschaffe dir einen Überblick über die Feature-Flächen.
2. Starte den Preview-Server und umgehe das Whop-Gate per geseedetem localStorage
   (gleiche Technik wie in plan/session-prompt-stb-luecken.md beschrieben — echtes
   Whop-Login geht im Preview nicht).
3. Teste jede Feature-Fläche im Browser: Schalter umlegen, Rechnung mit fehlenden
   §14-Angaben anlegen (muss blocken), Reverse-Charge-Fall durchspielen (EU-B2B),
   OSS-Modul öffnen und einen Eintrag anlegen, SKR-Badges sichtprüfen.
4. Rechenlogik: Lass den fn-checker-Agent die zentralen USt-Berechnungsfunktionen
   (UVA-Summen, Soll/Ist-Periodenzuordnung, RC-Netto-Ausweis) auf Logikfehler prüfen.
5. Gefundene Bugs direkt fixen, erneut verifizieren, committen.

Akzeptanz: Jedes der 5 Features einmal real im Browser durchgespielt, Screenshot-Beleg,
fn-checker-Befund dokumentiert, Fixes committet. Danach Memory-Eintrag
ust-regelbesteuerung-fixes.md auf „browserverifiziert" aktualisieren.
```

---

## P0-3 · Echter 2-Profil-Cloud-Sync-E2E-Test (mit mir zusammen)

```
Im Repo Web 1.7 ist der E2E-verschlüsselte Cloud-Sync live (api/sync.js + Upstash Redis
fra1). Mock-Tests bestanden, aber der echte Test mit zwei Browser-Profilen und echtem
Whop-Login steht noch aus — letzter offener Punkt vor dem Launch-Go für Cloud-Sync.

Aufgabe: Führe mich Schritt für Schritt durch den 11-Schritte-Testplan in CLOUD-SYNC.md.
Ich (der User) bediene die Browser-Profile in Edge, du sagst mir bei jedem Schritt genau,
was ich tun und was ich sehen soll, und wertest meine Rückmeldungen aus. Prüfe dabei
besonders: Push von Profil A → Pull auf Profil B, Konflikt-Fall (beide offline geändert,
4h-Grace-Logik), Art.-17-Löschung (Server-Daten wirklich weg), und dass im Netzwerk-Tab
nur Ciphertext (AES-GCM) übertragen wird, nie Klartext.

Falls ein Schritt fehlschlägt: Ursache im Code diagnostizieren, Fix vorschlagen, aber
nichts deployen ohne mein Go.

Akzeptanz: Alle 11 Schritte mit Ergebnis protokolliert (bestanden/gescheitert) in einer
kurzen Datei plan/cloud-sync-e2e-protokoll.md, Memory cloud-sync-e2e-verifikation.md
aktualisiert.
```

---

## P0-4 · Finaler Pre-Launch-QA-Sweep

```
/qa

Fokus auf die launch-kritischen Pfade der Web 1.7:
1. Kompletter Neukunden-Flow: Landing → Whop-Checkout-Link → (Gate) → Onboarding
   Firma anlegen → erste Einnahme → erste Rechnung → EÜR-Export.
2. Verschlüsseltes Backup erstellen + Restore (js/backup-crypto.js) — Roundtrip mit
   echten Daten aller Module (Lager, Fahrtenbuch, Eigenbelege company-präfixiert!).
3. GoBD-Pfade: festgeschriebenen Beleg stornieren (nie löschen), Periodensperre greift.
4. Datum-Handling: keine toISOString-Reste für Tagesdaten (Regel: toLocaleDateString('sv-SE')).
5. Offline-Grace: 4h-Grace nach Netzwerkverlust, Konflikt-Banner erscheint korrekt.

Alles was bricht: fixen, im Browser re-verifizieren, committen. Am Ende eine
Restliste „bekannt, aber nicht launch-blockierend" in plan/qa-restliste.md.
```

---

## P0-5 · Security-Finalcheck vor Launch

```
/security-stackr

Danach zusätzlich /red-team mit Fokus auf:
1. Whop-Gate-Umgehung: Kann man mit manipuliertem localStorage dauerhaft ohne Abo in
   die App (auch auf den Standalone-Seiten lager/rechnungen/eigenbelege, die erst
   2026-07-04 ans Gate angeschlossen wurden)? Grace-Stempel fälschbar?
2. api/sync.js: Kann User A an Daten von User B (fremde sub)? Rate-Limiting vorhanden?
   Können abgelaufene/gefälschte Whop-Tokens Grants anlegen oder pullen?
3. CSP-Stand nach PR#6 + Additiv-CSP-Drift-Fixes: noch inline-Handler-Reste, unsafe-*?
4. Secrets: keine Upstash/Whop-Keys clientseitig oder in Git-Historie der letzten Commits.

Kritische Funde sofort fixen + committen. Ergebnis als kurze Risiko-Tabelle
(Fund / Schwere / Status) — nur echte Funde, keine Theorie-Liste.
```

---

## P0-6 · Anwalts-Paket schnüren (Rechtstexte-Finalstand)

```
Im Repo Web 1.7: Die Anwalt-Freigabe für §11 AGB ist beauftragt aber offen, und die
neue Trial-Klausel (vorzeitiges Erlöschen des Widerrufsrechts, § 356 Abs. 5 BGB —
riskant bei Dauerschuldverhältnis, siehe frühere Analyse) muss in dieselbe Prüfrunde.
Whop-DPA/AV-Vertrag ist ebenfalls noch offen.

Aufgaben:
1. Lass den legal-reviewer-Agent den AKTUELLEN Stand von agb.html, refund.html,
   datenschutz.html und impressum.html komplett prüfen: Konsistenz untereinander
   (Trial überall gleich beschrieben? Whop als Merchant of Record überall korrekt?
   US-Datentransfer/SCC erwähnt?), fehlende Pflichtangaben, tote §-Verweise.
2. Erstelle ein 1-seitiges Anwalt-Briefing (plan/anwalt-briefing.md) mit:
   (a) den konkreten zu prüfenden Klauseln (Volltext-Zitate mit Fundstelle),
   (b) unseren offenen Fragen (§356-Abs.-5-Problem, §11-Haftung, Trial-Auto-Charge),
   (c) Fakten-Steckbrief: 15 €/M / 135 €/J, 7-Tage-Trial mit Auto-Charge, Whop als
   MoR (US, SCC), lokal-first-Datenhaltung, optionaler E2E-Cloud-Sync auf EU-Server.
3. Separater Abschnitt: Whop-DPA-Status — was genau fehlt uns von Whop (DPA/AVV,
   Subprozessor-Liste), wo beantragt man das, Formulierungsvorschlag für die Anfrage.

Nichts an den Rechtstexten selbst ändern ohne mein Go — nur Befund + Briefing.
```

---

## P1-1 · Steuerberater-Read-Only fertigbauen

```
→ Fertiger Prompt liegt bereits in plan/session-prompt-stb-luecken.md — 1:1 copy-pasten.
(Zwei Client-Lücken: StB ohne Abo durchs Login-Gate lassen + zweite Lücke laut Datei.
Branch feature/csp-phase-c. Nur nötig, falls StB-Feature zum Launch dabei sein soll —
laut Memory wartet es auf Kunden-Go.)
```

---

## P1-2 · Landing-Copy + technisches SEO-Minimum

```
/copy-marketing

Danach mit dem stackr-marketing-Agent:
1. Landing (index.html/landing.html): Wird der 7-Tage-Trial als primärer CTA klar?
   Offline-gratis vs. Web-Pro (15 €/M, 135 €/J, 45 € Ersparnis) in <10 Sek. verständlich?
   Cloud-Sync/überall-Zugriff als Web-Mehrwert sichtbar? 3 konkrete Verbesserungs-Diffs
   vorschlagen, nach meinem Go einbauen.
2. Technisches SEO-Minimum auf allen öffentlichen Seiten prüfen und fixen:
   <title>, meta description, genau ein <h1>, lang="de", Open-Graph-Tags, Canonical.
3. Keine erfundenen Claims, keine Steuerberatungs-Versprechen. Jede Zahl belegen
   oder rauslassen.

Akzeptanz: Diffs verifiziert im Browser (Edge/Preview), committet, kurze Vorher/Nachher-Notiz.
```

---

## P1-3 · Launch-Baseline messen (Juli Woche 1 aus dem Wachstumsplan)

```
Arbeite Woche 1 aus plan/2026-07-juli.md ab („Realität messen"):
Erstelle das 1-Seiten-Dokument plan/baseline-2026-07.md mit: geschätzte Offline-
Nutzerbasis (frag mich nach Download-Zahlen/Whop-Konten/E-Mail-Liste — ich liefere
die Zahlen), verfügbare Kontaktkanäle zu Bestandsnutzern, aktuelle zahlende Abos,
Trial-Starts, und die größte Funnel-Lücke. Abschluss-Einschätzung: Ist die
300-Abos-Ramp bis 31.12. realistisch oder muss plan/README.md angepasst werden?
Falls keine Analytics existieren: als Lücke notieren und das datenschutzfreundlichste
Minimal-Setup vorschlagen (kein Tracking-Consent-Monster, DSGVO-konform).
```

---

## P2-1 · Local 1.7 spiegeln + verwaistes Git reparieren

```
Der Ordner „Local 1.7" (Parallel-Variante von Web 1.7) hat ein verwaistes Git-Repo
und es besteht Parallel-Session-Risiko. Aufgaben:
1. Prüfe den Git-Zustand von Local 1.7 (verwaist seit wann, was fehlt) und repariere
   das Repo, ohne Arbeitsstände zu verlieren (vorher Sicherungskopie des Ordners).
2. Gleiche ab, welche Web-1.7-Fixes seit dem letzten Sync (2026-07-11, Icon/Onboarding-
   Fix) noch nicht in Local gespiegelt sind — insbesondere alles Committete seit
   13e20ab — und spiegle die relevanten (Local hat kein Whop-Gate/Cloud-Sync,
   also nur die geteilten Module).
3. Beachte die bekannten Sync-Regeln aus Memory stackr-project-layout.md.
Akzeptanz: Local-Git funktionsfähig, Sync-Stand dokumentiert, nichts überschrieben.
```

---

## P2-2 · Performance + Accessibility vor breiter Werbung

```
/performance-audit

Danach /accessibility. Beides mit Fokus auf die Landing + den Onboarding-Flow
(erste 5 Minuten eines Neukunden). Nur Maßnahmen mit Aufwand ≤ 1 Tag umsetzen,
Rest als priorisierte Liste in plan/perf-a11y-backlog.md. WCAG-Kontrast-Fixes
gab es schon (btn-success/btn-danger) — nicht doppelt fixen.
```

---

## Nicht-Prompt-Punkte (kann nur der User selbst)

- **Anwalt:** Briefing aus P0-6 an die Kanzlei geben, Freigabe §11 + Trial-Klausel abwarten.
- **Whop:** DPA/AVV bei Whop anfordern (Formulierung liefert P0-6).
- **Deploy:** Nach P0-1/P0-2/P0-4/P0-5 einmal deployen und Prod-Smoke-Test (Checkout war am 2026-07-11 schon E2E-verifiziert).
