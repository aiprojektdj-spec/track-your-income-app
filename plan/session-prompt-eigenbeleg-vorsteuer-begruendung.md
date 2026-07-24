# Prompt für neue Session (copy-paste) — Eigenbeleg-Vorsteuerabzug rechtlich einschränken

---

Kontext: GoBD-Audit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`,
Fund 3+6). Reine Rechtsfrage (kein Code-Mechanik-Bug) — nach dem Fixen zwingend mit
`legal-reviewer`-Agent gegenprüfen.

Voraussetzung: `[[gobd-eigenbeleg-auditlog-storno]]` sollte zuerst gebaut sein (gleicher
Funktionsbereich `eigenbelege/js/app.js`, vermeidet doppelte Merge-Konflikte).

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Fund 3: `js/euer.js` `eigenbelegeVorsteuer` — Vorsteuerabzug aus Eigenbelegen pauschal erlaubt

`eigenbelege/js/app.js:663-668` bietet im Formular ein `eb-mwst`-Dropdown (0/7/19 %); `js/euer.js`
übernimmt `betragMwst` aus jedem Eigenbeleg 1:1 als abziehbare Vorsteuer in die EÜR-Berechnung —
ohne Einschränkung.

Rechtlich falsch verallgemeinert: §15 Abs. 1 UStG verlangt für den Vorsteuerabzug grundsätzlich
eine **ordnungsgemäße Rechnung eines Dritten** (§14/14a UStG). Ein Eigenbeleg ersetzt einen
fehlenden Fremdbeleg nur als Nachweis der Betriebsausgabe dem Grunde und der Höhe nach — er
begründet **grundsätzlich keinen Vorsteuerabzug**. Ausnahmen sind eng (z.B. glaubhafte
Rekonstruktion eines tatsächlich erhaltenen, aber verlorenen Kleinbetragsbelegs mit offenem
USt-Ausweis nach §33 UStDV). Genau das Muster, das bei einer Betriebsprüfung zur vollständigen
Rückabwicklung + Nachzahlungszinsen (§233a AO) führt.

## Fund 6: `eigenbelege/js/app.js` `BEGRUENDUNGEN` (Z. 188–195) — hängt mit Fund 3 zusammen

Generische Begründungsliste ohne explizite Nennung der §33-UStDV-Sonderfälle; erschwert saubere
Abgrenzung "Nachweis der Ausgabe" vs. "enger Vorsteuer-Ausnahmefall". Gleicher Fix-Ort wie Fund 3.

## Fix-Vorschlag

1. Vorsteuerabzug aus Eigenbelegen in `euer.js` standardmäßig auf 0 setzen.
2. Nur zulassen, wenn der Nutzer explizit den engen Ausnahmefall (verlorener Beleg, nachweislich
   offener USt-Ausweis, §33 UStDV) über eine eigene Checkbox/Begründung im Eigenbeleg-Formular
   bestätigt.
3. `BEGRUENDUNGEN`-Liste (Fund 6) um die §33-UStDV-Sonderfälle als eigene, klar benannte Option(en)
   ergänzen, damit die neue Checkbox (Punkt 2) eine passende Begründung anbieten kann.
4. UI-Warnhinweis direkt im MwSt-Dropdown ergänzen ("Vorsteuerabzug aus Eigenbelegen nur in engen
   Ausnahmefällen zulässig — siehe §33 UStDV").

## Akzeptanzkriterien

- Neuer Eigenbeleg ohne die §33-UStDV-Checkbox → `betragMwst` fließt NICHT in die EÜR-Vorsteuer ein.
- Checkbox gesetzt + passende Begründung gewählt → Vorsteuer wird wie bisher übernommen.
- Bestehende Alt-Eigenbelege (ohne das neue Feld): Migrationsentscheidung treffen — vermutlich
  konservativ auf "kein Vorsteuerabzug" migrieren, da rechtlich der sicherere Default, es sei denn
  User widerspricht.
- `legal-reviewer`-Agent bestätigt: §33-UStDV-Ausnahme korrekt abgebildet, kein zu weiter/zu enger
  Anwendungsbereich.

Nach Fertigstellung: Browser-Smoketest (Eigenbeleg mit/ohne Checkbox anlegen, EÜR-Vorsteuer-Summe
prüfen), danach `legal-reviewer` gegenprüfen lassen.
