# Feature-Gap: Entscheidungen zu G1, G2, G7, G8, G9, G10 (2026-08-12)

**Quelle:** [`funde-audit-03-feature-gap-2026-08-10.md`](funde-audit-03-feature-gap-2026-08-10.md)
**Kontext:** Auftrag war, die Fundliste vollständig abzuarbeiten. Diese sechs Posten sind
abgearbeitet — nicht durch Code, sondern durch eine begründete Entscheidung. Für alle sechs gilt
derselbe Grund in verschiedenen Ausprägungen: sie verlangen einen Server, der die Klardaten des
Nutzers sieht.

**Was aus dem G-Block gebaut wurde:** G3 (Zahlungsabgleich, `f1bf917`), G5 (Bezeichnung
richtiggestellt, `fa41524`), G6 (Zahlungslink, `365d930`). G4 (OCR) hat eine fertige
Spezifikation und wartet auf eine CSP-Freigabe — siehe
[`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md).

---

## Die gemeinsame Grenze

Stackr speichert lokal. Der optionale Cloud-Sync ist Ende-zu-Ende-verschlüsselt: der Schlüssel
entsteht auf dem Gerät, liegt seit `eafc902` als nicht-extrahierbarer `CryptoKey` in IndexedDB,
und der Server sieht ausschließlich Chiffrat. Das ist keine Implementierungsdetail-Frage, sondern
das Produktversprechen — es steht auf der Landingpage, in der Datenschutzerklärung und in der
Verfahrensdokumentation.

Jede Funktion, die einen Server braucht, der Beträge, Namen oder Belege im Klartext liest, kostet
dieses Versprechen. Nicht ein bisschen: entweder der Server kann mitlesen oder nicht.

Deshalb ist die Antwort auf diese sechs Posten nicht „später", sondern **„so nicht"** — mit
jeweils unterschiedlichen Auswegen.

---

## G1 — ELSTER-Direktübermittlung 🔴 P0

**Was fehlt:** sevDesk und Lexware übermitteln die Umsatzsteuer-Voranmeldung per Klick, ohne dass
der Nutzer ein eigenes Zertifikat braucht. Stackr exportiert eine CSV, die von Hand ins
ELSTER-Formular übertragen wird.

**Warum nicht baubar:** Die Übermittlung läuft über ERiC, eine native Bibliothek der
Finanzverwaltung. Sie läuft nicht im Browser. Wer sie serverseitig betreibt, schickt die
vollständigen Umsatzsteuerdaten seiner Nutzer im Klartext durch den eigenen Server — und wird
damit zum Auftragsverarbeiter für steuerliche Daten, mit allem, was daran hängt.

Die Alternative wäre, dass jeder Nutzer sein eigenes ELSTER-Zertifikat einbindet. Das ist genau
die Hürde, die die Konkurrenz abnimmt; ein halber Schritt bringt hier nichts.

**Entscheidung:** nicht bauen. Stattdessen die Position offensiv vertreten. Der Export ist seit
`5a3c79b` (U11) kein Sackgassen-Toast mehr, sondern erklärt in drei Schritten, wie die Werte ins
Formular kommen. Das ist ehrlicher als ein Klick, der Daten aus der Hand gibt.

**Fürs Marketing:** „Deine Umsatzsteuerdaten gehen nicht über unseren Server. Dafür überträgst du
sechs Zahlen selbst." Das ist ein Argument, kein Mangel — aber nur, wenn es so gesagt wird.

---

## G2 — PSD2-Bankanbindung 🟠 P1

**Was fehlt:** sevDesk holt Umsätze automatisch von über 4.000 Banken. Stackr braucht eine
manuell exportierte Datei.

**Warum nicht baubar:** Eine PSD2-Anbindung verlangt einen lizenzierten Kontoinformationsdienst
(FinTS/XS2A über einen Anbieter wie finAPI oder Klarna Kosma), einen Vertrag, wiederkehrende
Kosten pro Nutzer — und einen Server, der die Umsätze abruft und zwischenspeichert. Derselbe
Konflikt wie G1, zusätzlich mit Aufsichtsrecht.

**Entscheidung:** nicht bauen. Der Abstand ist durch **G3** deutlich kleiner geworden: der
Import erkennt seit `f1bf917` nicht nur Ausgaben, sondern ordnet Zahlungseingänge offenen
Rechnungen zu. Damit fehlt gegenüber sevDesk nur noch der Dateidownload beim Onlinebanking, nicht
mehr die Auswertung danach.

---

## G7 — Team- / Mehrbenutzerzugang 🟡 P2

**Was fehlt:** Mehrere Personen an denselben Daten.

**Warum es klemmt:** Die Gerätesperre (`oyi_device_owner_uid`) bindet eine Installation bewusst
an genau eine Whop-Identität — das ist der Kern des Lizenzmodells. Echte Mehrbenutzer-Nutzung
bräuchte Schlüsselverteilung an mehrere Personen, Rollen und Rechte pro Datensatz, und eine
Konfliktauflösung bei gleichzeitigen Änderungen. Der Sync ist heute für **ein** Konto auf
mehreren Geräten gebaut, nicht für mehrere Personen.

**Entscheidung:** bewusst offen, wie im Fund vermerkt. Der praktisch wichtigste Fall ist bereits
abgedeckt: der **Steuerberater-Zugang** (`js/stb-share.js`) gibt Nur-Lese-Zugriff über einen
Envelope, dessen Schlüssel der Mandant kontrolliert — seit `5388954` mit Fingerabdruck-Prüfung
des Empfänger-Schlüssels.

Für die Zielgruppe (Freelancer, Einzelunternehmen, GbR mit zwei Partnern) ist der offene Rest
klein. Wird Team-Arbeit ein Thema, ist es ein eigenes Produktvorhaben mit Architekturentscheidung
— kein Fund, den man abarbeitet.

---

## G8 — Native Mobile-App 🟢 P3

**Was fehlt:** eine App im Store.

**Bewertung:** Der Fund selbst nennt sie erst zusammen mit G4 sinnvoll — der einzige Grund für
eine native App wäre die Kamera für Belegfotos, und die funktioniert im mobilen Browser ebenfalls
(`<input type="file" accept="image/*" capture>` ist im Eigenbeleg-Modul bereits im Einsatz).

Eine native App ist außerdem kein Feature dieses Repos, sondern ein zweites Produkt: eigene
Codebasis, zwei Store-Freigaben, eigener Releasezyklus — und bei Apple 15–30 % Provision auf
digitale Abos, was die Preisstruktur von 15 €/Monat unmittelbar betrifft.

**Entscheidung:** nicht bauen. Falls mobil mehr Gewicht bekommt, ist der nächste Schritt eine
**PWA** (installierbar, Offline-Cache, Homescreen-Icon) — dieselbe Codebasis, ohne Store und ohne
Provision. Das wäre ein eigener, überschaubarer Fund; die Local-First-Architektur kommt einer PWA
ohnehin entgegen.

---

## G9 — Auftragsbestätigung / Lieferschein 🟢 P3

**Was fehlt:** zwei weitere Dokumenttypen neben Rechnung, Angebot und Gutschrift.

**Warum nicht nebenbei:** Ein neuer Dokumenttyp ist im Rechnungsmodul kein neuer Wert in einem
Dropdown. Er berührt den Nummernkreis, die GoBD-Festschreibung, die §14-Pflichtangaben-Prüfung,
den XRechnung-Export (ein Lieferschein darf dort **nicht** als E-Rechnung herausgehen), die
Statusübergänge und das Audit-Log. Halb eingebaut wäre er ein Fehlerherd in genau dem Modul, das
gerade zwei Vollaudits hinter sich hat.

Dazu kommt: die §14-Logik greift heute an `typ === 'rechnung' || typ === 'gutschrift'`. Ein
Lieferschein müsste ausdrücklich **ausgenommen** werden — er ist keine Rechnung und trägt keine
Steuernummer-Pflicht. Diese Ausnahme sauber zu ziehen ist die eigentliche Arbeit.

**Entscheidung:** nicht in dieser Runde. Der Fund selbst stuft den Bedarf als fraglich ein, und
das deckt sich mit der Zielgruppe: wer Dienstleistungen abrechnet, braucht keinen Lieferschein.
Sollte er kommen, gehört er als eigener Auftrag mit Testabdeckung gebaut, nicht als Anhängsel.

---

## G10 — Lesende REST-API 🟢 P3

**Was fehlt:** ein Weg, Daten programmatisch auszulesen. Heute gehen nur Webhooks **hinaus**
(`js/webhooks.js`, clientseitig ausgelöst).

**Warum nicht baubar:** Eine lesende API müsste auf dem Server auf Klardaten zugreifen. Der
Server hat aber nur Chiffrat und bekommt den Schlüssel nie zu sehen — das ist kein Versäumnis,
sondern der ganze Sinn der Konstruktion. Eine API wäre nur möglich, wenn der Nutzer seinen
Schlüssel hochlädt; dann ist die Ende-zu-Ende-Verschlüsselung beendet.

**Was es stattdessen gibt und was reicht:**
- Webhooks nach außen (Make.com, Zapier) — clientseitig, mit dem Schlüssel im Browser.
- Vollständiger, verschlüsselter Datenexport als JSON.
- DATEV-Buchungsstapel und, seit `caedf9f`, der GoBD-Z3-Export für die Betriebsprüfung.

**Entscheidung:** nicht bauen. Der realistische Bedarf — „meine Daten in ein anderes System" — ist
über Export und Webhooks gedeckt.

---

## Zusammenfassung

| Fund | Entscheidung | Ersatz / Ausweg |
|---|---|---|
| G1 ELSTER | nicht bauen | Export mit Anleitung (U11), Haltung offensiv vertreten |
| G2 PSD2 | nicht bauen | G3 schließt den praktischen Teil der Lücke |
| G7 Team | bewusst offen | StB-Zugang deckt den Hauptfall |
| G8 Native App | nicht bauen | ggf. PWA als eigener Fund |
| G9 Lieferschein | nicht in dieser Runde | eigener Auftrag mit Tests, wenn Bedarf entsteht |
| G10 REST-API | nicht bauen | Webhooks + Export + DATEV + Z3 |

Vier der sechs sind **dieselbe Entscheidung**: kein Server, der Klardaten sieht. Das ist die
Grenze, die dieses Produkt von den Wettbewerbern trennt — nach beiden Seiten. Sie gehört nicht
als Rückstand behandelt, sondern als Positionierung kommuniziert.
