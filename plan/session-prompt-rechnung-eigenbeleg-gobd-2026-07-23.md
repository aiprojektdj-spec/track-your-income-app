# Prompt für neue Session (copy-paste) — GoBD-Audit Rechnungen+Eigenbelege: Funde abarbeiten

---

Kontext: Am 2026-07-23 zwei parallele Agenten (`legal-reviewer` für §-Korrektheit, `general-purpose`
für Code-Mechanik) über `rechnungen/js/*` und `eigenbelege/js/app.js` laufen lassen — reine
Planungs-Session, nichts implementiert. Vor dem Abarbeiten IMMER `git status --short` +
`git log --oneline -10` frisch prüfen — im Repo laufen parallele Sessions im selben Ordner
(aktuell uncommittete Änderungen aus dem Steuer-Audit (`js/kassenbuch.js`, `js/ustvoranmeldung.js`)
und dem Lager-Feature-Batch (`js/lager.js`, `js/store.js`, `lager/index.html`, `lager/page.js`)
— nicht versehentlich überschreiben oder mit committen).

**Kernergebnis:** Rechnungsmodul (`rechnungen/js/*`) ist bereits GoBD-gehärtet (§14-Sperre,
Storno-statt-Löschen, geteilte Hash-Chain mit dem Haupt-Audit-Log). Das **Eigenbeleg-Modul
(`eigenbelege/js/app.js`) hat echte Lücken**: kein Audit-Log überhaupt, physisches Löschen ohne
Spur, und ein Komplett-Reset der Belegnummer bei "Alle löschen". Zusätzlich ein
Rechts-Fund unabhängig vom Code-Mechanik-Befund: Vorsteuerabzug aus Eigenbelegen ist in
`js/euer.js` pauschal erlaubt, obwohl das gesetzlich nur ein enger Ausnahmefall ist.

Nach dem Fixen: Re-Audit mit `/compliance-legal` (deckt GoBD explizit ab) und `/qa` (Daten-
integrität, IndexedDB/localStorage-Konsistenz) laufen lassen, um zu bestätigen, dass Audit-Log
und Nummernkreis jetzt lückenlos sind. Für den Vorsteuer-Fix (Rechtsfrage, keine reine Code-
Mechanik) danach `legal-reviewer`-Agent gegenprüfen lassen.

## 🔴 Hoch — Bußgeld-/Nachweisrisiko bei Betriebsprüfung

**1. `eigenbelege/js/app.js` — Eigenbelege ohne jedes Audit-Log bearbeit-/löschbar**

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

Fix (analog zum bereits gebauten Muster bei Rechnungen/Ausgaben, siehe `js/store.js` Z. 1015–1090
`_addAuditEntry`/Hash-Chain und `js/store.js:2083-2086` `deleteRechInvoice`→Storno-Pattern):
- `deleteBeleg` in offener Periode NICHT mehr physisch löschen, sondern Storno-Flag
  (`storniert`/`stornoGrund`/`storniertAm`) setzen, Beleg bleibt im Array.
- `saveBeleg`/`deleteBeleg` rufen vor der Mutation `Store._addAuditEntry` (oder ein
  Eigenbeleg-spezifisches Äquivalent mit gleicher Hash-Chain) mit alten+neuen Werten auf.
- Physisches Entfernen nur noch als interne Funktion für abgeschlossene Migrationen/Altfälle,
  nicht mehr über den normalen Lösch-Button erreichbar.

**2. `alleLoeschen()` (Z. 1735–1742) — kompletter Nummernkreis-Reset ohne Protokoll**

`localStorage.removeItem(_ebPrefix()+'eigenbelege_naechste_nummer')` setzt den Zähler
komplett zurück. Der nächste neu angelegte Beleg beginnt wieder bei `EB-<Jahr>-001` — **kompletter
Bruch der lückenlosen Nummernfolge**, dazu Vernichtung sämtlicher Belege ohne jeden Log-Eintrag.
Das ist der schärfste Einzelfund im gesamten Audit.

Fix: "Alle löschen" entweder ganz entfernen (Buchungsbelege dürfen nicht en bloc vernichtet
werden) oder auf Storno aller offenen Belege umstellen + Zähler NICHT zurücksetzen + einen
einzelnen Audit-Eintrag "Massenstorno" mit Anzahl/Zeitpunkt/Nutzer schreiben.

**3. `js/euer.js` `eigenbelegeVorsteuer` — Vorsteuerabzug aus Eigenbelegen pauschal erlaubt**

`eigenbelege/js/app.js:663-668` bietet im Formular ein `eb-mwst`-Dropdown (0/7/19 %);
`js/euer.js` übernimmt `betragMwst` aus jedem Eigenbeleg 1:1 als abziehbare Vorsteuer in die
EÜR-Berechnung — ohne Einschränkung. Rechtlich falsch verallgemeinert: §15 Abs. 1 UStG verlangt
für den Vorsteuerabzug grundsätzlich eine **ordnungsgemäße Rechnung eines Dritten** (§14/14a
UStG). Ein Eigenbeleg ersetzt einen fehlenden Fremdbeleg nur als Nachweis der Betriebsausgabe
dem Grunde und der Höhe nach — er begründet **grundsätzlich keinen Vorsteuerabzug**. Ausnahmen
sind eng (z. B. glaubhafte Rekonstruktion eines tatsächlich erhaltenen, aber verlorenen
Kleinbetragsbelegs mit offenem USt-Ausweis nach §33 UStDV). Genau das Muster, das bei einer
Betriebsprüfung zur vollständigen Rückabwicklung + Nachzahlungszinsen (§233a AO) führt.

Fix: Vorsteuerabzug aus Eigenbelegen in `euer.js` standardmäßig auf 0 setzen; nur zulassen, wenn
der Nutzer explizit den engen Ausnahmefall (verlorener Beleg, nachweislich offener USt-Ausweis,
§33 UStDV) über eine eigene Checkbox/Begründung im Eigenbeleg-Formular bestätigt. UI-Warnhinweis
direkt im MwSt-Dropdown ergänzen.

## 🟡 Mittel

**4. §14 Abs. 4 Nr. 7 UStG — im Voraus vereinbarte Entgeltminderungen (Skonto) fehlen**

Kein Feld in Rechnungspositionen/Formular (`rechnungen/js/rechnung.js`) für vereinbarte
Skonto-/Rabattbedingungen gefunden. Nur relevant, wenn beim Vertragsschluss bereits vereinbart
(nicht nachträgliche Zahlungserinnerung) — Feld ergänzen oder Freitextfeld für Zahlungsbedingungen
prüfen, ob es dafür bereits ausreicht.

**5. `rechnung.js:1305` `gbrEinst.geschaeftsfuehrer` — Freitextfeld ohne Mehrfach-Hinweis**

Bei GmbH/UG mit mehreren Geschäftsführern müssen laut §35a GmbHG ALLE genannt werden. Aktuell
einzelnes Freitextfeld ohne Validierung/Hinweistext dazu. Kleiner UX-Fix (Hinweistext im Label).

## 🟢 Niedrig

**6. `eigenbelege/js/app.js` `BEGRUENDUNGEN` (Z. 188–195)** — generische Begründungsliste ohne
explizite Nennung der §33-UStDV-Sonderfälle; erschwert saubere Abgrenzung „Nachweis der Ausgabe“
vs. „enger Vorsteuer-Ausnahmefall“ (hängt mit Fund 3 zusammen, gleicher Fix-Ort).

**7. E-Rechnung-Ausstellung ist Opt-in** — `xrechnung.js` erzeugt korrektes EN16931/
XRechnung-3.0-XML, aber nur als zusätzlicher Export neben PDF, nicht Standardversand. Für 2026
unkritisch (Ausstellungspflicht erst 2027/2028 gestaffelt), vor dem Stichtag aber prominenter
machen.

## Bereits sauber (keine Änderung nötig)

- **Rechnungsnummern-Lückenlosigkeit**: `js/store.js:2186-2219` (Counter je Typ+Jahr,
  "Peek zuerst"-Muster, Duplikatsschutz gegen Doppelklick).
- **§14-Sperre + Storno-only bei Rechnungen**: `js/store.js:2026-2031`
  (`_isRechInvoiceLocked`) + `2083-2086` (`deleteRechInvoice`→`stornoRechInvoice`), inkl.
  Kaskaden-Storno verknüpfter Sales und eigener Stornorechnung mit neuer Nummer
  (`createStornoRechnung`, Z. 2106–2153).
- **`rechnungen/js/protokoll.js` ist KEIN separates/schwächeres Log** — nur gefilterte Ansicht
  auf denselben zentralen `Store.getAuditLog()` mit Hash-Chain (`prevHash`/`checksum`,
  `js/store.js:1015-1090`). Identische Integrität wie das Haupt-Audit-Log.
- **§14-Pflichtangaben im Rechnungs-PDF**: vollständige Namen/Anschriften, Steuernr./USt-IdNr.,
  Datum, Nummer, Menge/Art, Leistungsdatum-Fallback, Entgelt je Steuersatz, §19-Hinweis,
  §13b-RC-Hinweis, §25a-Hinweis — alle vorhanden (`rechnung.js:1122-1313`).
- **Export/Backup**: `rechnungsbuch_`, `eigenbelege_`, `audit_log`-Keys explizit in der
  Backup-Whitelist (`js/store.js:118-122`, `exportAll` Z. 2322–2371). Für Rechnungen inkl.
  vollständiger Audit-Historie; für Eigenbelege aktuell nur der Datenstand (siehe Fund 1 — sobald
  dort ein Log existiert, wird es automatisch mit-exportiert, keine weitere Änderung am
  Export-Code nötig).
- **E-Rechnungsempfang**: `erechnung-import.js` parst UBL+CII korrekt, Empfangspflicht seit
  01.01.2025 abgedeckt, 8-Jahres-Aufbewahrungspflicht des Originals (§14b UStG) dokumentiert.

## Reihenfolge-Empfehlung

1. **Fund 1+2 zuerst** (Eigenbeleg-Audit-Log + Storno-Pattern + Zähler-Reset-Fix) — größter
   Einzel-Scope, aber das eigentliche GoBD-Loch. Beide hängen zusammen (gleiche Funktionen).
2. **Fund 3** (Vorsteuer-Eigenbeleg in `euer.js`) — kleinerer Code-Scope, aber eigene
   Rechtsfrage; nach dem Fix `legal-reviewer` gegenprüfen lassen (§33-UStDV-Ausnahme korrekt
   abgebildet?).
3. Fund 4+5 opportunistisch (klein, kein Zeitdruck).
4. Fund 6+7 nur bei Gelegenheit.

Nach Fix 1+2: Browser-Smoketest wie beim letzten GoBD-Rework (`[[gobd-edit-delete-rework]]`) —
Eigenbeleg anlegen → bearbeiten → Audit-Log-Eintrag prüfen (Protokoll-Seite bzw. `getAuditLog()`
in der Konsole) → löschen → prüft, ob jetzt Storno statt Verschwinden. Whop-Gate blockt echten
Login in Dev-Sessions (siehe frühere Sessions) — ggf. Node-Harness für die Store-Funktionen
zusätzlich zum Browser-Test nutzen.
