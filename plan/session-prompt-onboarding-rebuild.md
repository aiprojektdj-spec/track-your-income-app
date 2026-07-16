# Prompt für neue Session (copy-paste)

---

Kontext: Onboarding wird neu gebaut. Ist-Zustand + alle Design-Entscheidungen sind
mit dem User bereits Position für Position durchgesprochen (siehe unten). Noch NICHTS
implementiert — nur geplant. Bau jetzt den kompletten neuen Flow.

## Ist-Zustand (2 Onboardings hintereinander)

- **A) Firma-Screen** — `js/companies.js` (`showOnboarding`, ab Zeile ~680, Aktionen
  `co-select-land`/`co-submit-onboarding` ab Zeile ~900): Land (DE/AT/CH), Firmenname,
  Branche, Erkennungsfarbe → "🚀 Starten".
- **B) Stammdaten-Wizard** — `js/app.js` (`_showOnboarding`/`_renderOnboarding`/
  `_saveOnboardingStep`/`_finishOnboarding`/`_skipOnboarding`, ab Zeile ~1220), 5–6 Steps
  je nach Land (`isCH` an Zeile 1269 verzweigt in Kanton/Gemeinde/GJ + AHV/MWST):
  1. Firmenname + Ansprechpartner-Name
  2. Adresse/PLZ/Ort
  3. Telefon/Email
  4. Steuernummer/USt-ID/USt-Modus (Karten-UI `ust-picker`, DE) bzw. AHV/MWST-Nr/MWST-Modus (CH)
  5. (nur CH) Kanton/Gemeinde/Geschäftsjahr-Start
  5/6. Bankname/IBAN/BIC
  Plus Sprachwahl davor (`_showLangPicker`, Zeile ~1228) und Skip-Link auf Step 1
  ("Ich habe schon eine Firma — Setup überspringen", erst am 2026-07-15 gefixt, Commit
  `6527bcc` — ustMode-Default-Bug beim Skip).

## Entschiedener Ziel-Flow (User hat jede Position einzeln bestätigt)

Nur noch **1 Wizard, 5 Steps, DE-only** (kein Land-Picker — deckt sich mit
[Launch-Woche-Todo](launch-woche-2026-07-13.md) "CH/AT raus aus Web"; ganzer
`isCH`-Zweig in app.js kann komplett weg):

1. **Firma**: Firmenname, Ansprechpartner-Name, Branche (Dropdown, behalten) —
   Erkennungsfarbe NICHT mehr abfragen, stattdessen automatisch zufällig vergeben
   (später in Firmen-Einstellungen änderbar). Skip-Link bleibt hier.
2. **Adresse**: Adresse/PLZ/Ort (eigener Step, NICHT mit Kontakt zusammenlegen — User
   wollte Steps getrennt lassen)
3. **Kontakt**: Telefon (optional, kein `required`), Email
4. **Steuer**: Steuernummer + USt-ID (beide behalten, beide optional) + USt-Modus als
   Karten-UI wie bisher (Klein-/Regelbesteuerung mit Gesetzes-Fakten) — User will hier
   explizit KEINE Vereinfachung zu Radio/Toggle
5. **Bank**: Bankname/IBAN/BIC (optional), letzter Step

companies.js-Screen (Land/Firmenname/Branche/Farbe) verschmilzt komplett in Step 1 des
app.js-Wizards. Kein zweiter Onboarding-Screen mehr davor — Firma wird direkt beim
`_finishOnboarding` bzw. äquivalent angelegt (`CompanyManager`-Firma-Erstellung in
Step-1-Submit einbauen statt als eigenen vorgeschalteten Screen).

## Umsetzung

- `js/app.js`: `isCH`-Verzweigung raus (Zeilen ~1269, 1412–1438 Kanton/Gemeinde/GJ-Step,
  CH-Zweig in Step 4 Zeile ~1329–1369). `totalSteps` fix auf 5. Step 1 um Branche-Feld
  erweitern (Optionsliste aus `CompanyManager.BRANCHEN`, siehe companies.js Zeile ~687),
  Farbe automatisch (Zufallsfarbe aus vorhandener Farbpalette, siehe companies.js
  `farbenHtml`-Quelle).
- `js/companies.js`: `showOnboarding()` (Zeile ~680) + `_selectLand`/`_selectLandBtn`
  (Land-Auswahl) können weg oder zumindest nicht mehr im User-Flow aufgerufen werden —
  prüfen, ob `_showOnboarding` in app.js diesen Screen noch VOR dem Wizard aufruft; falls
  ja, den Aufruf entfernen und Firmenanlage direkt in `_finishOnboarding` (app.js)
  einbauen (CompanyManager-Firma mit Land fix `'DE'` erzeugen).
- `_skipOnboarding` (app.js Zeile ~1514) unverändert lassen (Bug ist schon gefixt,
  ustMode-Default bleibt wie in Commit `6527bcc`).
- Sprachwahl (`_showLangPicker`) bleibt unverändert davor — war nicht Teil der Fragen,
  nicht anfassen.

## Verifizieren

Browser-Preview: `localStorage.clear()` simulieren (oder frisches Profil), kompletten
Flow durchklicken (Firma → Adresse → Kontakt → Steuer → Bank → Finish), prüfen dass:
- Firma wird mit Land `'DE'` angelegt, Branche korrekt übernommen, Farbe zufällig gesetzt
- Skip-Link auf Step 1 funktioniert weiterhin (ustMode-Default korrekt)
- Kein toter Code-Pfad für CH mehr erreichbar über den normalen Onboarding-Flow
  (CH bleibt ggf. in Local 1.7 bestehen — NUR Web 1.7 betreffen laut Launch-Woche-Todo)

Nach Fertigstellung: Memory `onboarding-skip-existing-company.md` und
`launch-woche-2026-07-13.md` aktualisieren falls die dortigen Onboarding-Punkte damit
erledigt sind.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Klar spezifizierte UI-Umbau-Aufgabe in bekannten
Dateien (app.js Onboarding-Funktionen, companies.js Onboarding-Screen), keine
unklare Architektur-Entscheidung mehr offen — alle Positionen sind vom User bereits
einzeln abgenickt. Reines Ausführen + Browser-Verifikation.
