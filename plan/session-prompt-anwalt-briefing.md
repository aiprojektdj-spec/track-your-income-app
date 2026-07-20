# Prompt für neue Session (copy-paste) — Anwalts-Briefing erstellen (§11 + §356)

---

Kontext: P0-6 aus `plan/offene-punkte-2026-07-15.md` — Anwalt ist bereits beauftragt,
aber es gibt noch **kein zusammenhängendes Briefing-Dokument**. Diese Aufgabe existiert
bereits als Stichpunkt-Prompt in `plan/launch-prompts.md` (Abschnitt "P0-6 · Anwalts-
Paket schnüren") — dieser Prompt hier ist die ausformulierte Version davon, mit den
konkreten Fundstellen aus dieser Session ergänzt.

**Wichtig zur Einordnung:** Diese Session erstellt NUR das Briefing-Dokument
(Text + Fundstellen + offene Fragen) für den Anwalt — sie ändert NICHT selbst die
Rechtstexte und schickt NICHTS an den Anwalt ab. Das Versenden macht der User.

Zentrale Dateien: `agb.html`, `refund.html`, `datenschutz.html`, `impressum.html`,
`plan/anwalt-notiz-trial-widerruf.md` (bestehende Vorarbeit zu §356), diese Session
soll daraus `plan/anwalt-briefing.md` erstellen (neu, noch nicht vorhanden).

## 1. Aktualitäts-Check zuerst

Die Rechtstexte wurden seit der letzten Anwalt-Notiz mehrfach geändert (u. a.
2026-07-16: CH/AT-Klauseln aus `agb.html`/`datenschutz.html` entfernt, siehe Memory
`ch-at-removal-web.md`). Vor dem Schreiben des Briefings: `git log --oneline -- agb.html
datenschutz.html refund.html impressum.html` durchgehen, damit das Briefing den
AKTUELLEN Stand zitiert, nicht einen veralteten.

## 2. `legal-reviewer`-Agent für Vollständigkeits-/Konsistenz-Check einsetzen

Prüfen lassen (siehe auch `plan/launch-prompts.md` P0-6):
- Ist der Trial (7 Tage, Kartenpflicht, Auto-Charge) in `agb.html` §4, `agb.html` §6
  und `refund.html` §1/§3 überall identisch beschrieben?
- Ist Whop als Merchant of Record überall konsistent benannt (nicht mal "Zahlungs-
  dienstleister", mal "Merchant of Record" mit unterschiedlicher Bedeutung)?
- US-Datentransfer/SCC/DPF-Verweise in `datenschutz.html` — nach der CH-Klausel-
  Entfernung (2026-07-16) nochmal auf Vollständigkeit prüfen, ob die verbleibenden
  DSGVO-Art.-44ff-Passagen noch stimmig sind ohne den Schweiz-Absatz.
- Tote §-Verweise oder Abschnitts-Anker (z. B. `agb.html#empfehlungsprogramm` —
  existiert der Abschnitt noch nach evtl. Umstrukturierung?).

## 3. `plan/anwalt-briefing.md` erstellen — Inhalt

**(a) Konkret zu prüfende Klauseln** — Volltext-Zitat + Fundstelle (Datei:Zeile):
- `agb.html §11` — Haftungsbegrenzung (Softwarefehler, Datenverlust-Haftungsausschluss).
  Zitat + Frage: hält die Begrenzung einer AGB-Kontrolle nach §307 BGB stand,
  insbesondere ggü. Verbrauchern?
- `agb.html §6` + `refund.html §1` — Widerrufsrecht-Klausel, siehe Punkt (b).

**(b) Offene Fragen** (aus `plan/anwalt-notiz-trial-widerruf.md` übernehmen + einbauen,
nicht neu erfinden):
1. Tritt „vollständige Ausführung" i. S. v. § 356 Abs. 5 BGB bei einem
   Dauerschuldverhältnis (Abo) überhaupt so ein, wie die aktuelle Formulierung
   suggeriert, oder braucht es eine Klausel, die auf „in Anspruch genommene Nutzung"
   abstellt?
2. Ist die weiche Formulierung ("wird praktisch erst relevant, sobald...") rechtlich
   haltbar oder zu vage?
3. §11-Haftungsbegrenzung: konkret aus dem AGB-Text zitieren und fragen, ob die
   Formulierung Verbraucherschutz-konform ist.

**(c) Fakten-Steckbrief** (damit der Anwalt nicht erst recherchieren muss):
- Preis: 15 €/Monat, 135 €/Jahr, inkl. MwSt.
- 7-Tage-Trial mit Kartenpflicht, Auto-Charge nach Ablauf, 1× pro Whop-Konto.
- Whop (Whop Inc., USA) als Merchant of Record — Payment + Auth, SCC/DPF als
  Transfermechanismus.
- Datenhaltung: lokal-first (Browser localStorage/IndexedDB), optionaler
  Ende-zu-Ende-verschlüsselter Cloud-Sync auf EU-Servern (Vercel/Upstash, Frankfurt).
- Zielgruppe: Freelancer, Kleinunternehmer, GbR (Deutschland, seit 2026-07-16 kein
  CH/AT-Angebot mehr, siehe Memory `ch-at-removal-web.md` — falls der Anwalt nach
  Schweizer Klauseln fragt: die wurden bewusst entfernt, App ist jetzt DE-only).

## Abschluss

- `plan/anwalt-briefing.md` ist das Ergebnis — 1-seitig, klar strukturiert nach (a)/(b)/(c).
- Nichts an `agb.html`/`refund.html`/`datenschutz.html`/`impressum.html` selbst ändern.
- Nicht an den Anwalt verschicken — das macht der User.
- `plan/offene-punkte-2026-07-15.md` (P0-6-Zeile) und `plan/anwalt-notiz-trial-
  widerruf.md` nach Abschluss verlinken/aktualisieren.

---

**Modell-Empfehlung: Sonnet 5.** Grund: strukturierte Recherche + Dokumentenerstellung,
keine eigene Rechtsentscheidung nötig — das `legal-reviewer`-Subagent-Ergebnis wird nur
sauber aufbereitet, nicht neu bewertet.
