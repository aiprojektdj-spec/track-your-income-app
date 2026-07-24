# Prompt für neue Session (copy-paste) — Eigenbeleg-Audit-Log + Storno-Pattern + Zähler-Fix

---

Kontext: GoBD-Audit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`,
Fund 1+2 — dort im Volltext, hier extrahiert als eigene Baustelle). Größtes reines
Compliance-Loch im gesamten Rechnungen/Eigenbelege-Audit: das Eigenbeleg-Modul hat **kein**
Audit-Log, im Gegensatz zum bereits GoBD-gehärteten Rechnungsmodul.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Fund 1: `eigenbelege/js/app.js` — Eigenbelege ohne jedes Audit-Log bearbeit-/löschbar

- `saveBeleg()` (Z. 719–783) überschreibt beim Editieren `belege[idx] = beleg` (Z. 774) direkt —
  alte Werte (`betragBrutto`, `mwstSatz`, `begruendung` etc.) gehen ohne Protokoll verloren.
- `deleteBeleg()` (Z. 1261–1266) → `purgeEigenbelegEverywhere()` (Z. 1276ff.) entfernt den Beleg
  physisch (`splice`) aus allen firmen-präfixierten Keys — kein Storno-Objekt bleibt zurück.
- Volltextsuche nach `protokoll|Protokoll|audit` in der Datei: **0 Treffer.** Kein Aufruf von
  `Store._addAuditEntry` (oder Äquivalent) irgendwo im Modul.
- Periodensperre existiert zwar (`isBelegGesperrt`, Z. 1245–1250, prüft `Store.isPeriodLocked`;
  greift in `editBeleg`/`deleteBeleg`) — schützt aber nur abgeschlossene Perioden. In der
  laufenden (offenen) Periode ist ein Eigenbeleg, der bereits Grundlage einer Betriebsausgabe/
  Vorsteuer war, **spurlos** entfernbar.

Rechtsgrundlage: §146 Abs. 4 HGB, GoBD Rz. 36 ff. (Unveränderbarkeit von Buchungsbelegen).

## Fund 2: `alleLoeschen()` (Z. 1735–1742) — kompletter Nummernkreis-Reset ohne Protokoll

`localStorage.removeItem(_ebPrefix()+'eigenbelege_naechste_nummer')` setzt den Zähler komplett
zurück. Der nächste neu angelegte Beleg beginnt wieder bei `EB-<Jahr>-001` — **kompletter Bruch
der lückenlosen Nummernfolge**, dazu Vernichtung sämtlicher Belege ohne jeden Log-Eintrag. Das ist
der schärfste Einzelfund im gesamten Audit.

(Die reine GoBD-Sperre gegen `alleLoeschen()` auf gesperrte Belege ist bereits über den
Vollaudit-Fund 4 gefixt, s. `[[rechnung-eigenbeleg-vollaudit-2026-07-23]]` — hier geht es um den
Zähler-Reset + fehlendes Protokoll, ein zusätzliches, noch offenes Problem.)

## Fix-Vorschlag (beide Funde zusammen, gleiche Funktionen)

Analog zum bereits gebauten Muster bei Rechnungen (`js/store.js` Z. 1015–1090 `_addAuditEntry`/
Hash-Chain und `js/store.js:2083-2086` `deleteRechInvoice`→Storno-Pattern), s. auch
`[[gobd-edit-delete-rework]]`:

1. `deleteBeleg` in offener Periode NICHT mehr physisch löschen, sondern Storno-Flag
   (`storniert`/`stornoGrund`/`storniertAm`) setzen, Beleg bleibt im Array.
2. `saveBeleg`/`deleteBeleg` rufen vor der Mutation `Store._addAuditEntry` (oder ein
   Eigenbeleg-spezifisches Äquivalent mit gleicher Hash-Chain) mit alten+neuen Werten auf.
3. Physisches Entfernen nur noch als interne Funktion für abgeschlossene Migrationen/Altfälle,
   nicht mehr über den normalen Lösch-Button erreichbar.
4. "Alle löschen" entweder ganz entfernen (Buchungsbelege dürfen nicht en bloc vernichtet werden)
   oder auf Storno aller offenen Belege umstellen + Zähler NICHT zurücksetzen + einen einzelnen
   Audit-Eintrag "Massenstorno" mit Anzahl/Zeitpunkt/Nutzer schreiben.

## Akzeptanzkriterien

- Eigenbeleg bearbeiten → alte Werte landen als Audit-Log-Eintrag (Hash-Chain, wie bei Rechnungen).
- Eigenbeleg löschen (offene Periode) → Storno-Flag statt physischem Verschwinden, bleibt in der
  Liste sichtbar (z.B. ausgegraut/gefiltert).
- "Alle löschen" setzt den Belegnummer-Zähler NICHT mehr zurück, schreibt einen Massenstorno-Eintrag.
- Export/Backup nimmt das neue Audit-Log automatisch mit (keine Code-Änderung am Export nötig,
  sobald das Log existiert — Backup-Whitelist ist bereits generisch).

Nach dem Fixen: Re-Audit mit `/compliance-legal` (GoBD) und `/qa` (Datenintegrität) laufen lassen.
Browser-Smoketest wie beim letzten GoBD-Rework: Eigenbeleg anlegen → bearbeiten → Audit-Log-Eintrag
prüfen (Protokoll-Seite bzw. `getAuditLog()` in der Konsole) → löschen → prüfen ob jetzt Storno
statt Verschwinden. Whop-Gate blockt echten Login in Dev-Sessions — ggf. Node-Harness für die
Store-Funktionen zusätzlich zum Browser-Test nutzen.
