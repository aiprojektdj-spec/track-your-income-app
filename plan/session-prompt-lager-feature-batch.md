**Status: Punkt 6, 4, 7, 1, 5 gebaut + browserverifiziert (2026-07-23).** Rest (2, 3, 8, 9, 10) noch offen,
siehe Fortschritts-Notiz am Dateiende.

# Prompt für neue Session (copy-paste) — Lager-Modul Feature-Batch + USt-ID-Bug

---

## Kontext

Ein Kunde hat per WhatsApp eine Liste von Wünschen fürs Lager-Modul + einen Rechnungs-Bug
gemeldet (siehe Screenshots in der Plan-Session vom 2026-07-23). Diese Datei bündelt die
geklärten Anforderungen aus einer Q&A-Runde mit dem User (nicht dem Kunden direkt) und ist die
Bauvorlage für die Umsetzung. Vorher `git status`/`git log` frisch prüfen.

Betroffene Dateien (Stand der Recherche 2026-07-23): `js/lager.js` (Haupt-Lagerlogik, ~2400
Zeilen), `js/store.js` (Datenhaltung, company-scoped via `_rechPrefix`/`_prefix`),
`rechnungen/js/rechnung.js` (`addPositionFromLagerArt()` ~Zeile 448, `mergeRechSettings()` Zeile
18, `generatePreviewHtml()` Zeile 1050), `rechnungen/js/unternehmensdaten.js` (Firmenstammdaten
inkl. USt-IdNr.), `eigenbelege/js/app.js` (Eigenbeleg-Formular).

---

## 1. Kategorien: frei editierbar + festes Zielgruppe-Feld

**Ist-Zustand:** `Lager.STATUS`-unabhängige Warenkategorie ist eine hart codierte Liste
(`js/lager.js` ~Zeile 659): Kleidung, Schuhe, Elektronik, Bücher, Haushalt, Sport, Accessoires,
Sonstiges. Kein Verwaltungs-UI, keine eigenen Kategorien möglich.

**Soll (User-Entscheidung: "Beides kombiniert"):**
1. Warenkategorie wird frei editierbar: Nutzer kann eigene Kategorien anlegen/umbenennen/löschen.
   Die 8 bestehenden Werte werden beim ersten Aufruf als Start-Vorschlag in den company-scoped
   Store migriert (nicht hart im Code bleiben).
2. Zusätzlich ein neues, festes Feld "Zielgruppe" (Vorschlag: Herren/Damen/Unisex — ggf. auch
   Kinder ergänzen, mit User beim Bauen kurz abstimmen) als separate Auswahl am Artikel.
3. Beide Felder im Artikel-Anlegen/-Bearbeiten-Formular UND als Filter in der Lager-Übersicht.

**Bauplan-Hinweis:** analog zum bestehenden `Store.getEinkaufsquellen()`/`addEinkaufsquelle()`-
Muster (Zeile 2162 ff. in `js/lager.js`) — company-scoped Liste mit Schnellauswahl + "Sonstiges
…"-Custom-Add. Für Kategorien zusätzlich Löschen/Umbenennen-UI nötig (Einkaufsquelle hat das noch
nicht).

---

## 2. Status: frei editierbar, bestehende 7 als Vorschläge

**Ist-Zustand:** `Lager.STATUS_CONFIG` (Zeile 37-45) ist ein hart codiertes Objekt mit 7 Werten
(verfuegbar, reserviert, verkauft, beschadigt, reinigung, reparatur, ausgelistet), inkl. Farbe/
Icon/Badge-Klasse. Wird an ~12 Stellen im Code referenziert (Filter, Badges, Bulk-Status, Export,
Sortierung).

**Soll (User-Entscheidung: "Voll frei + Vorschläge"):** Nutzer kann eigene Status anlegen,
umbenennen, löschen. Die 7 aktuellen Werte sind Vorbelegung (Vorschlag), keine Pflicht.

**Wichtig beim Bauen:**
- Company-scoped Custom-Status-Store nötig (wie Kategorien).
- Migration: bestehende Artikel mit `status: 'verkauft'` etc. müssen nach Umbau weiter
  funktionieren, auch wenn der Nutzer den Vorschlag später umbenennt/löscht (Fallback-Label für
  verwaiste Status-Keys einbauen, sonst brechen alte Datensätze in der Anzeige).
- `verkauft`/`verfuegbar` sind an mehreren Stellen im Code (nicht nur Anzeige) als String-Literal
  fest verdrahtet (z.B. `js/store.js` `stornoSale()`, `deleteSale()`, `js/lager.js` Zeile 1516/
  1568/1834 `p.status === 'verfuegbar'`). Diese Business-Logik-Stati (verfügbar/verkauft) sollten
  intern als stabile System-Keys bestehen bleiben und NICHT umbenennbar/löschbar sein — nur die
  übrigen (reserviert, beschadigt, reinigung, reparatur, ausgelistet) plus neue eigene Status sind
  frei. Das vorher mit dem User klären, sonst brechen Storno-/Verkaufslogik.

---

## 3. Farben: Mehrfachauswahl pro Artikel

**Ist-Zustand:** 1 Farbe pro Artikel via `<input type="color">` (Zeile 1438-1442), kein Array.

**Soll (User-Entscheidung: "Mehrere Farben pro Artikel"):** Ein Artikel kann mehrere Farben
gleichzeitig haben (z.B. zweifarbiger Schuh). `p.farbe` (string) → `p.farben` (array) umbauen.
UI: Farb-Chips zur Mehrfachauswahl aus vordefinierter Palette + "eigene Farbe"-Picker wie bisher,
mehrfach hinzufügbar.

**Migration:** bestehende `p.farbe`-Werte beim Lesen in `p.farben: [p.farbe]` überführen
(Lazy-Migration wie schon bei `artikelNr`, Zeile 93-111 — gleiches Muster nutzen).

---

## 4. Artikelnummer: manuell editierbares Feld, eigener Filter

**Ist-Zustand:** `p.artikelNr` wird automatisch vergeben (Zeile 93-111, Format `JAHR-NNN`), taucht
nur in der allgemeinen Volltextsuche auf (Zeile 559), kein eigenes Filterfeld in der
Lager-Übersicht.

**Soll:** Artikelnummer bleibt 1 Wert pro Artikel (kein Tag-Array), aber:
1. Manuell editierbar/überschreibbar sowohl im Einzel- als auch im Bulk-Einkauf-Formular (aktuell
   nur automatisch vergeben, kein Eingabefeld).
2. Eigenes Filterfeld in der Lager-Übersicht, unabhängig von Größe/Marke/Kategorie filterbar
   (bisher nur Teil der kombinierten Textsuche).

---

## 5. Neues Feld "Lieferant/Händler" (getrennt von Einkaufsquelle)

**Ist-Zustand:** `p.einkaufsquelle` existiert bereits als company-scoped Liste mit Schnellauswahl
(`Store.getEinkaufsquellen()`/`addEinkaufsquelle()`, Zeile 2162 ff.) — aber nur im
Artikel-Bearbeiten-Formular (`le_einkaufsquelle`), nicht als Filter, nicht in Bulk-Einkauf, nicht
in Eigenbelegen geprüft.

**Soll (User-Entscheidung):** Einkaufsquelle = Kanal (z.B. "Vinted", "Retoure", "Flohmarkt").
Neues, separates Feld **Lieferant/Händler** = konkreter Name der Person/Firma (z.B. "Max
Mustermann", "Schuh GmbH"):
1. Neues Feld `p.haendler` (o.ä.), company-scoped Liste mit Schnellauswahl nach demselben Muster
   wie Einkaufsquelle (`Store.getHaendler()`/`addHaendler()` + "Sonstiges …"-Custom-Add).
2. Muss existieren in: Einzel-Einkauf-Formular, Bulk-Einkauf-Formular, UND im
   Eigenbeleg-Formular (`eigenbelege/js/app.js` — dort prüfen, ob es ein äquivalentes Feld/Konzept
   schon gibt, sonst neu anlegen).
3. Als Filter in der Lager-Übersicht (das war der ursprüngliche Wunsch "Dienstleister filtern").

**Vorab prüfen:** ob `Store.getEinkaufsquellen()` als Vorlage 1:1 kopierbar ist oder ob es
Sinn macht, eine gemeinsame generische Helper-Funktion für "company-scoped Schnellauswahl-Liste"
zu bauen, da jetzt mindestens 3 solcher Felder existieren (Einkaufsquelle, Kategorie, Händler) —
Code-Duplikation vermeiden.

---

## 6. Storno-Freigabe auch bei festgeschriebenen (gesperrten) Belegen

**Ist-Zustand:** `Store.stornoSale()` (`js/store.js` Zeile 1470-1497) setzt den verknüpften
Einkauf beim Verkaufs-Storno automatisch zurück auf `status: 'verfuegbar'` — **außer** der Einkauf
ist bereits GoBD-festgeschrieben (`!this.isLocked(p)`-Check, Zeile 1489). Bei festgeschriebenen
Belegen (z.B. nach Rechnungsstorno eines abgeschlossenen Zeitraums) bleibt der Artikel dauerhaft
fälschlich auf "Verkauft" stehen. Das war vermutlich der Kern von "Verkaufte Sachen die storniert
wurden aus verkauft rausnehmen" + "Erneut hochladen nach Stornierung".

**Soll (User-Entscheidung, mit Vorbehalt):** "Ja, solange das GoBD-konform ist" — Lager-Status
soll auch bei gesperrten Belegen auf "Verfügbar" zurückgesetzt werden können. Freigabe ist rein
intern (nur wieder als verfügbar im Lager sichtbar/filterbar), **kein** externes
Neu-Einstellen auf Verkaufsplattformen.

**GoBD-Einschätzung (vorläufig, vor Bau mit `legal-reviewer`-Agent absichern):** Der `status`
eines Lagerartikels ist reine Bestandsführungs-Metadatum, keine Finanzbuchung/kein
Rechnungsinhalt — die eigentliche GoBD-relevante Unveränderbarkeit betrifft die Rechnung/den
Verkaufsbeleg selbst (bleibt storniert + Audit-Trail über `_addAuditEntry`), nicht den
Lagerbestand. Sollte daher unkritisch sein, aber vor dem Bauen kurz mit dem `legal-reviewer`-Agent
gegenchecken, da der User selbst "solange das GoBD-konform ist" als Bedingung genannt hat.

**Bauplan:**
1. `Store.stornoSale()`: `!this.isLocked(p)`-Check für die reine Status-Rückgabe entfernen (Audit-
   Trail-Eintrag bleibt in jedem Fall bestehen, unabhängig vom Lock-Status).
2. Gleiche Änderung in `deleteSale()` (Zeile 1499-1523, hat denselben Lock-Check) prüfen — dort
   wird bei offener Periode ohnehin storniert statt gelöscht, aber der Freigabe-Check ist separat.
3. Kein neuer UI-Text/Button nötig — bestehender Storno-Flow reicht, Ergebnis ist einfach dass der
   Artikel danach wieder als "Verfügbar" filterbar ist.

---

## 7. Eigenständiges Anmerkungen-Feld am Artikel

**Ist-Zustand:** Es gibt bereits ein Notizen-Feld, aber nur am **Verkauf** (`s.notizen`, Formular
`vk_notizen`/`se_notizen`), nicht am Einkauf/Artikel selbst.

**Soll (User-Entscheidung):** Neues freies Textfeld direkt am Artikel/Einkauf (`p.anmerkung`),
unabhängig vom späteren Verkaufs-Notizfeld — z.B. "Kratzer an der Sohle", "Geschenk von XY".
Im Einzel- und Bulk-Einkauf-Formular ergänzen, in Tabellen-/Detailansicht und CSV-Export
mitführen (analog zur bestehenden `Quelle`/`Notizen`-Spalte im Export, Zeile 1107-1108/1123).

---

## 8. Suchleisten global auf Klick-Suche umstellen

**Ist-Zustand:** mind. die Lager-Suche (`js/lager.js` Zeile 1896) sucht live bei jedem
Tastendruck (`addEventListener('input', ...)`).

**Soll (User-Entscheidung: "Überall in der App"):** Alle Live-Suchfelder auf Klick-Suche
(Such-Button oder Enter-Taste) umstellen, nicht nur Lager.

**Bauplan:** vor dem Bauen eine kurze Bestandsaufnahme aller `addEventListener('input', ...)` an
Suchfeldern app-weit machen (Rechnungen/Kunden/Produkte, Eigenbelege, ggf. weitere Module) — nicht
blind alle `input`-Listener anfassen, da manche live-Filter (Zahlenfelder, Formulare) NICHT
gemeint sind, nur Text-Suchfelder. Einheitliches Muster: Enter-Taste ODER Klick auf Such-Icon löst
aus, Eingabe selbst löst nichts mehr aus.

---

## 9. "Artikel aus Lager hinzufügen"-Dialog (Rechnungen): volle Filter + Bild

**Ist-Zustand:** `addPositionFromLagerArt()`-Dialog in `rechnungen/js/rechnung.js` (~Zeile 448,
siehe `js/lager.js` Zeile 1158 `availPurchases`) zeigt aktuell verfügbare Lagerartikel ohne Bild
und ohne eigene Such-/Filterleiste.

**Soll (User-Entscheidung: "Volle Filter + Bild"):** Gleiche Filter wie in der Lager-Übersicht
(Kategorie, Marke, Status, Zielgruppe, Händler etc. — nach Bau der Punkte 1+5 oben) zusätzlich zu
einem Vorschaubild pro Zeile (Artikel hat bereits `p.foto`, siehe Zeile 161 in `js/lager.js`).
Sinnvoll als Reihenfolge: erst Punkt 1+5 bauen, dann diesen Dialog auf die dort neu entstandenen
Filterfelder erweitern.

---

## 10. USt-ID fehlt auf GbR-Rechnungen (Regelbesteuerung) — Diagnose vor Fix

**Ist-Zustand (verifiziert per Code-Lesen 2026-07-23):** Beide Haupt-Renderpfade lesen die USt-ID
korrekt company-scoped:
- `rechnungen/js/rechnung.js` `mergeRechSettings()` (Zeile 18-32): merged
  `Store.getRechUnternehmen()` (company-scoped über `_rechPrefix`, `js/store.js` Zeile 2109) in
  `Store.getSettings()`, `ustId` wird korrekt übernommen wenn nicht leer.
- `generatePreviewHtml()` (Zeile 1050 ff.) nutzt `mergeRechSettings()`, rendert die Tax-Zeile
  (Zeile 1182-1188) wenn `settings.steuernummer || settings.ustId` gesetzt ist — unabhängig vom
  Kleinunternehmer/Regelbesteuerung-Modus.
- `rechnungen/js/xrechnung.js` `mergeSettings()` (Zeile 326-336) macht dasselbe für den
  XRechnung-XML-Export.

Der Code-Pfad selbst scheint also korrekt. User-Angabe: Bug betrifft konkret die **GbR**-Firma,
soll bei **jeder neuen** Rechnung erscheinen (kein Snapshot-/Altbestand-Problem).

**Wahrscheinlichste Ursachen (zu prüfen, bevor irgendwas geändert wird):**
1. **Naheliegendste Erklärung:** Unter der aktiven GbR-Firma ist im Formular "Unternehmensdaten"
   (`ud_ustId`, `rechnungen/js/unternehmensdaten.js` Zeile 122/346) schlicht kein Wert
   eingetragen — jede Firma hat eigene, company-scoped Unternehmensdaten. Falls die USt-ID nur
   unter der anderen Firma (Einzelunternehmen) hinterlegt wurde, greift für die GbR korrekt der
   leere Fallback. **Erster Schritt der nächsten Session: mit dem User/Testdaten live prüfen, ob
   unter der aktiven GbR das Feld tatsächlich befüllt ist.**
2. Falls das Feld befüllt ist und trotzdem leer erscheint: prüfen ob `Store._companyId` beim
   Firmenwechsel zuverlässig gesetzt ist, BEVOR `unternehmensdaten.js` `_loadData()` aufruft (Race
   zwischen Firmenwechsel-Event und Formular-Render) — ggf. wird beim Speichern unter der falschen
   `_rechPrefix` geschrieben oder das Formular zeigt gecachte Werte der zuvor aktiven Firma.
3. Randfall: GbR + Regelbesteuerung könnte über einen anderen Modul-Pfad laufen
   (`js/gbr-modul.js` statt der normalen Rechnungs-App) — dort prüfen, ob eigene
   Rechnungserzeugung existiert, die NICHT über `mergeRechSettings()`/`generatePreviewHtml()`
   läuft (bisher nicht verifiziert, da außerhalb des Kern-Rechnungsmoduls).

**Bauplan:** Erst Diagnose 1-3 oben durchführen (Live-Test mit Whop-Login durch User nötig, da
Session selbst nicht eingeloggt testen kann), danach gezielten Fix je nach Ursache. Nicht blind
Code ändern ohne bestätigte Ursache — der Kern-Mechanismus sieht beim Lesen korrekt aus.

---

## Reihenfolge-Empfehlung

1. Punkt 6 (Storno-Freigabe) — klein, isoliert, hoher Kundennutzen, GoBD-Check mit
   `legal-reviewer`-Agent vorab.
2. Punkt 10 (USt-ID-Diagnose) — braucht Live-Test durch User, kann parallel/vorab geklärt werden.
3. Punkt 4 + 7 (Artikelnummer-Feld, Anmerkungen-Feld) — klein, unabhängig.
4. Punkt 1 + 5 (Kategorien frei + Zielgruppe + Händler-Feld) — mittelgroß, gemeinsames
   Store-Pattern, sinnvoll zusammen bauen.
5. Punkt 2 (Status frei editierbar) — größter Umbau (STATUS_CONFIG an ~12 Stellen referenziert),
   eigene Session empfehlenswert.
6. Punkt 3 (Farben-Array) — mittelgroß, eigene Migration nötig.
7. Punkt 9 (Lager-Dialog in Rechnungen) — baut auf 1+5 auf, danach.
8. Punkt 8 (Suchleisten global) — unabhängig, aber Bestandsaufnahme zuerst.

## Akzeptanzkriterien (pro Punkt beim Bauen ergänzen, hier nur Gesamt-Checkliste)

- Alle Migrationen (Farben-Array, Kategorien, Status) sind lazy/rückwärtskompatibel — bestehende
  Kundendaten (Web + ggf. Local 1.7) brechen nicht.
- `verfuegbar`/`verkauft` bleiben intern stabile System-Keys, unabhängig vom neuen
  Status-Editor.
- Neue Felder (Zielgruppe, Händler, Anmerkung) sind optional, keine Pflichtfelder die bestehende
  Bulk-Importe/Bulk-Einkäufe brechen.
- Browser-Smoke für jeden Punkt einzeln (Whop-Gate — ggf. User für Live-Test einbinden wie bei
  anderen Sessions).
- Nach Abschluss: `plan/todo-rest-*.md` aktualisieren, Local-1.7-Spiegelung einplanen
  (`plan/session-prompt-local-spiegeln.md`).

---

**Modell-Empfehlung: Sonnet 5 reicht für die meisten Punkte.** Punkt 10 (USt-ID) und Punkt 6
(GoBD-Storno-Freigabe) sollten mit dem `legal-reviewer`-Agent gegengecheckt werden, kein Opus
nötig — die fachliche Klärung ist überwiegend schon in dieser Datei erledigt.

---

## Fortschritt 2026-07-23 (Session 2)

Geklärt vorab: Zielgruppe = Herren/Damen/Unisex/Kinder (4 Werte). Scope = Reihenfolge-Empfehlung
abarbeiten, nach 1+5 gestoppt für Review.

**Gebaut + browserverifiziert:**
- **Punkt 6** (Storno-Freigabe bei gesperrten Belegen): GoBD-Check via `legal-reviewer` bestanden
  (Lagerstatus ist kein Buchungsobjekt). `Store.stornoSale()`/`deleteSale()` in `js/store.js` geben
  Lagerstatus jetzt auch bei gesperrten Einkäufen frei, mit explizitem Audit-Trail-Eintrag
  (`'lager-status'`) der die Ausnahme benennt (legal-reviewer-Vorgabe).
- **Punkt 7** (Anmerkungen-Feld): war bereits gebaut (`p.notizen` in Neu-Artikel-Modal,
  Edit-Modal, CSV/XLSX-Export) — Plan-Annahme war veraltet, nichts zu tun.
- **Punkt 4** (Artikelnummer): manuell editierbar in Neu-Artikel-Modal (`neu_artikelnr`),
  Edit-Modal (`le_artikelnr`) und Bulk-Einkauf pro Zeile (`bulk_artikelnr_*`, bei Anzahl>1 wird
  `-1`/`-2`… angehängt, nie beim Duplizieren übernommen). Eigenes Filterfeld `lagerFilterArtikelnr`
  in der Lager-Übersicht. Nebenbei gefixt: Text-Suche verschwand bisher beim Wechsel eines anderen
  Dropdown-Filters (applyFilters baute `_filters` neu ohne `.search`).
- **Punkt 1 + 5** (Kategorien frei + Zielgruppe + Händler): neue generische Store-Helper
  `_getScopedList()`/`_addScopedListItem()` in `js/store.js`, darauf aufbauend
  `getWarenkategorien()/addWarenkategorie()/renameWarenkategorie()/deleteWarenkategorie()` (Rename
  migriert bestehende Artikel automatisch, da Kategorie reiner Anzeigetext ohne Key-Indirektion ist)
  und `getHaendler()/addHaendler()`. Neues festes `Store.ZIELGRUPPEN` (Herren/Damen/Unisex/Kinder).
  Felder in Neu-Artikel-Modal, Edit-Modal und Bulk-Einkauf (dort als gemeinsame Felder für die ganze
  Session, nicht pro Zeile — analog zu Einkaufsquelle/Datum). Neuer "🏷️ Kategorien"-Button im
  Lager-Header öffnet Verwalten-Modal (anlegen/umbenennen/löschen). Filter für Kategorie (jetzt
  dynamisch statt hart codiert), Zielgruppe, Händler in der Lager-Übersicht.
  Eigenbeleg-Formular (`eigenbelege/js/app.js`) hat mit "Verkäufer / Absender" bereits ein
  äquivalentes Feld (`eb-vk-name`) — laut Plan-Vorgabe unverändert gelassen.

**Nicht angefasst (bewusst, laut Reihenfolge-Empfehlung):** Punkt 2 (Status frei editierbar — größter
Umbau, eigene Session), Punkt 3 (Farben-Array), Punkt 8 (Suchleisten global), Punkt 9 (Lager-Dialog in
Rechnungen — baut auf 1+5 auf, jetzt möglich), Punkt 10 (USt-ID-Diagnose — braucht Live-Test durch User).

**Offen:** Local-1.7-Spiegelung der Punkte 6/4/7/1/5 (siehe `plan/session-prompt-local-spiegeln.md`).
