# Prompt für neue Session (copy-paste) — Rechnung: kleine Rechtstext-Ergänzungen (Skonto, Geschäftsführer, E-Rechnung)

---

Kontext: GoBD-Audit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`,
Fund 4+5+7). Drei unabhängige Kleinigkeiten, in der Quelle als "opportunistisch"/"bei Gelegenheit"
eingestuft (kein Zeitdruck) — hier gebündelt, weil jede für sich zu klein für eine eigene Datei ist.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Fund 4: §14 Abs. 4 Nr. 7 UStG — im Voraus vereinbarte Entgeltminderungen (Skonto) fehlen

Kein Feld in Rechnungspositionen/Formular (`rechnungen/js/rechnung.js`) für vereinbarte
Skonto-/Rabattbedingungen gefunden. Nur relevant, wenn beim Vertragsschluss bereits vereinbart
(nicht nachträgliche Zahlungserinnerung).

Fix: Feld ergänzen oder prüfen, ob ein bestehendes Freitextfeld für Zahlungsbedingungen dafür
bereits ausreicht (ggf. nur Beschriftung/Hinweistext ergänzen statt neues Feld).

## Fund 5: `rechnung.js:1305` `gbrEinst.geschaeftsfuehrer` — Freitextfeld ohne Mehrfach-Hinweis

Bei GmbH/UG mit mehreren Geschäftsführern müssen laut §35a GmbHG ALLE genannt werden. Aktuell
einzelnes Freitextfeld ohne Validierung/Hinweistext dazu.

Fix: Hinweistext im Label ergänzen (z.B. "bei mehreren Geschäftsführern: alle nennen, §35a GmbHG").
Kein neues Feld nötig, reine Label-Ergänzung.

## Fund 7: E-Rechnung-Ausstellung ist Opt-in

`xrechnung.js` erzeugt korrektes EN16931/XRechnung-3.0-XML, aber nur als zusätzlicher Export neben
PDF, nicht Standardversand. Für 2026 unkritisch (Ausstellungspflicht erst 2027/2028 gestaffelt),
vor dem Stichtag aber prominenter machen.

Fix (kein Zeitdruck, nur vormerken): E-Rechnung-Export UI prominenter platzieren (z.B. neben dem
PDF-Export-Button statt in einem Untermenü), sobald sich der Stichtag nähert. Kein funktionaler
Bug, reine UX-Priorisierung.

## Akzeptanzkriterien

- Skonto-Hinweis/-Feld sichtbar bei Rechnungserstellung, wird korrekt in PDF/E-Rechnung-XML
  übernommen falls als eigenes Feld umgesetzt.
- Geschäftsführer-Feld zeigt den §35a-GmbHG-Hinweis bei Rechtsform GmbH/UG.
- E-Rechnung-Fund 7 ist nur eine Notiz/spätere UX-Aufgabe — keine harte Akzeptanzbedingung für
  diese Session, kann übersprungen werden falls kein Kapazität.

Kein Browser-Smoketest zwingend nötig (reine Text-/Label-Ergänzungen), kurzer Sichtcheck reicht.
