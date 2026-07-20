# Prompt für neue Session (copy-paste) — Whop-DPA/AV-Vertrag: Anfrage vorbereiten

---

Kontext: P0-6 aus `plan/offene-punkte-2026-07-15.md` — Whop-DPA/AV-Vertrag (Art. 28
DSGVO) ist noch nicht angefordert. Whop tritt für Auth+Payment als **eigenständig
Verantwortlicher** auf (nicht Auftragsverarbeiter, siehe `datenschutz.html`, Abschnitt
"Auftragsverarbeitung (AVV)"), trotzdem kann für bestimmte Datenflüsse (z. B. reine
Zahlungsabwicklungsdaten) ein DPA/Subprozessor-Nachweis relevant/anfragbar sein — das
muss diese Session erst klären, nicht annehmen.

**Wichtig zur Einordnung:** Diese Session recherchiert und **entwirft nur die Anfrage**
(Text + Ansprechpartner/Weg bei Whop). Das tatsächliche Absenden/Anfordern bei Whop
macht der User — das ist Kommunikation mit einem Drittanbieter im Namen des Unter-
nehmens, keine Code-Änderung.

## 1. Erst klären: was genau fehlt uns von Whop?

- `datenschutz.html` (Abschnitt 5 „Whop") nochmal lesen — dort steht bereits, dass
  Whop als eigenständig Verantwortlicher auftritt, nicht als Auftragsverarbeiter.
  Falls das rechtlich korrekt ist, ist ein klassischer AVV/DPA nach Art. 28 DSGVO
  gar nicht das passende Instrument — dann braucht es stattdessen ggf. einen
  **Joint-Controller-Nachweis** oder schlicht die öffentlich verfügbaren Whop-
  Datenschutz-/SCC-Dokumente als Beleg für den Transfermechanismus (Art. 44ff DSGVO).
  **Das zuerst mit dem `legal-reviewer`-Agent klären, bevor eine "DPA-Anfrage" formuliert
  wird, die am eigentlichen Bedarf vorbeigeht.**
- Falls doch ein AVV-Bedarf besteht (z. B. für den optionalen Cloud-Sync-Pfad, falls
  Whop dort irgendeine Rolle spielt — verifizieren, ob das der Fall ist, laut Memory
  `cloud-sync-blob-architecture.md` sind das eigentlich Vercel/Upstash, nicht Whop):
  das als Grundlage für die Anfrage nehmen.

## 2. Recherche: wo/wie fordert man das bei Whop an?

- Whop-Entwicklerdokumentation / Whop-Support-Kanäle nach "Data Processing Agreement",
  "DPA", "Subprocessor list", "GDPR" durchsuchen (WebSearch/WebFetch auf offiziellen
  Whop-Domains, keine Drittquellen).
- `agb.html` referenziert bereits `https://whop.com/buyer-terms/` — prüfen ob es eine
  vergleichbare offizielle Seite für Merchant-seitige Datenschutz-/Compliance-Doku gibt
  (z. B. `whop.com/legal`, `whop.com/privacy`, o. ä. — NICHT raten, tatsächlich
  nachsehen und die echte URL im Ergebnis nennen).
- Prüfen ob es einen Whop-Business-/Merchant-Support-Kontakt (E-Mail, Formular, Dashboard-
  Funktion) gibt, über den man als Merchant (nicht als Endkunde) Compliance-Dokumente
  anfragt.

## 3. Anfrage-Text entwerfen

Kurzer, professioneller E-Mail-/Formular-Entwurf (Deutsch + Englisch, falls der
Whop-Support vermutlich englischsprachig ist):
- Wer wir sind (Stackr / Secondlife Vintage, Einzelunternehmen, DE) und welche
  Whop-Produkte/IDs genutzt werden (Merchant-Account-Kontext, keine Kundendaten).
- Konkrete Bitte: DPA/Subprozessor-Liste bzw. — je nach Ergebnis aus Schritt 1 —
  Bestätigung des Verantwortlichkeits-Status und Nachweis des Transfermechanismus
  (SCC/DPF) für EU-Kunden-Daten.
- Referenz auf die eigene Datenschutzerklärung (Link `datenschutz.html`), damit
  Whop den Kontext hat.

## Abschluss

- Ergebnis: `plan/whop-dpa-anfrage.md` mit (a) Klärung ob AVV oder Joint-Controller-
  Nachweis der richtige Ansatz ist, (b) recherchierter Weg/Kontakt bei Whop
  (mit echter, verifizierter URL/Kontaktweg — kein Platzhalter), (c) fertiger
  Anfrage-Text zum Copy-Paste für den User.
- Nichts selbst an Whop senden.
- `plan/offene-punkte-2026-07-15.md` (P0-6-Zeile, Abschnitt "Rechtliches") nach
  Abschluss aktualisieren.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Recherche + Textentwurf, keine Code-Änderung.
Die einzige Stelle mit echtem Reasoning-Bedarf (AVV vs. Joint-Controller, Schritt 1)
sollte über den `legal-reviewer`-Agent laufen statt aus eigener Einschätzung entschieden
werden — Sonnet reicht, wenn dieser Agent die rechtliche Einordnung übernimmt.
