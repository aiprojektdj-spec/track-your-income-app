# Prompt für neue Session: Delta-Security-Funde fixen (2026-08-10)

> ## ✅ ABGEARBEITET am 2026-08-10 — alle 6 Funde
> 
> | Fund | Commit | Stand |
> |---|---|---|
> | 1 — SheetJS 0.18.5 → 0.20.3 | `5b62268` (+ `9c395ad`) | fertig, Web + Local |
> | 2 — Restore-Allowlist | `623ec23` | fertig, Web + Local |
> | 3 — `kdf.iterations` respektieren | `623ec23` (+ `35c0cd6`) | fertig, Web + Local |
> | 4 — StB-Public-Key-Fingerabdruck | `5388954` | fertig (Vollfix, beidseitig) |
> | 5 — PBKDF2 → 600.000 | `623ec23` | fertig |
> | 6 — HKDF für ECDH | `5388954` | fertig, mit Envelope-Version v2 |
> 
> **Abweichungen von diesem Plan (bewusst):**
> - **Kein `integrity=`-Attribut** für die Vendor-Skripte. SRI vergleicht einen Hash gegen eine
>   über das Netz geladene Datei; `js/vendor/*.js` sind lokale Dateien, wer sie ändern kann, ändert
>   das Attribut mit. Ersatz: SHA-256 in `js/vendor/VERSIONS.md` plus `.gitattributes -text`, damit
>   die Hashes nach einem Checkout überhaupt noch stimmen (`core.autocrlf=true` hätte sie zerstört).
> - **Fingerabdruck 64 Bit statt 32** (16 Hex in vier Gruppen). Der Angreifer ist hier per Annahme
>   der Betreiber und kann offline P-256-Paare erzeugen, bis eines den angezeigten Wert trifft — bei
>   32 Bit etwa ein Kern-Tag Arbeit. 64 Bit macht das aussichtslos und bleibt vorlesbar.
> - **Fund 6 mit Versionsfeld statt Bruch.** Der Plan hielt einen Envelope-Format-Wechsel für
>   nötig; stattdessen liest `unwrapKey` die Version aus dem Envelope (fehlendes `v` = v1 = alte
>   Roh-Ableitung), bestehende StB-Freigaben bleiben also gültig.
> - **Fund 3 zuerst umgesetzt, Reihenfolge 3 → 2 → 5 → 1 → 4 → 6** — wie im Plan verlangt musste
>   die `iterations`-Respektierung vor der `ITER`-Erhöhung sitzen.
> 
> **Nachträge, die beim Abarbeiten anfielen:**
> - `js/backup-crypto.js` in Local 1.7 hing auf dem Stand vom 25.07. und hatte den AAD-Fix vom
>   30.07. nie bekommen — Local konnte in Web erzeugte Backups **gar nicht** entschlüsseln
>   („Falsche Passphrase"). Mit der Spiegelung erledigt, Datei wieder byte-identisch.
> - `test/test-api-sync.js` forderte noch das Verhalten von vor `a4ade79` und schlug seit heute
>   Morgen fehl → nachgezogen (`cf152e9`).
> - KDF-Hash-Whitelist auf SHA-256/SHA-512 verengt (`35c0cd6`, Ergebnis des eigenen Review-Durchgangs).
> 
> **Tests:** `test/test-backup-crypto-restore.js` (5, neu), `test/test-vendor-xlsx-api.js` (6, neu),
> `test/test-stb-share.js` (3 → 8). Gesamte Suite: 16 Dateien, alle grün.
> 
> **Offen (nicht durch mich machbar):** der Klick-durch des Excel-Imports in Buchungen und Lager
> mit einer echten Datei — die Import-UI rendert erst nach Whop-Login. Bibliothek und alle
> Parse-Pfade sind im Browser gegen eine echte .xlsx verifiziert (SheetJS 0.20.3, keine
> Konsolenfehler, deutsche Datums- und Kommazahlen korrekt), der Login fehlt.
> Ebenso offen: 2-Account-Test des StB-Fingerabdruck-Abgleichs.

Kontext: Am 2026-08-10 wurde nach der Security-Sanierung (`session-prompt-security-fixes-2026-08-10.md`,
7 Funde gefixt) ein Delta-Audit gefahren, das gezielt die Flächen geprüft hat, die weder der
Sanierungs-Diff noch das Red-Team-Audit angefasst hatten: Backup-Krypto, Import-Pfade, StB-Envelope,
mitgelieferte Fremdbibliotheken. Vollständiger Befund: `plan/funde-audit-04-security-delta-2026-08-10.md`.
Ergebnis: 6 neue Funde, 2 davon P1. Arbeite sie in dieser Reihenfolge ab, committe nach jedem
logisch abgeschlossenen Fund einzeln (nicht alles in einen Mega-Commit).

## 🟠 P1 — 1. Mitgeliefertes SheetJS 0.18.5 mit zwei bekannten CVEs

Datei: `js/vendor/xlsx.full.min.js` (Version 0.18.5, im Bundle als `version="0.18.5"` lesbar).
Geladen in `app.html:239` und `lager/index.html:209`, genutzt in `js/app.js`, `js/buchungen.js`,
`js/lager.js`, `lager/page.js` — also auf dem Excel-**Import**-Pfad, der per Definition fremde
Dateien verarbeitet.

- CVE-2023-30533 — **Prototype Pollution** beim Lesen präparierter Dateien (behoben ab 0.19.3)
- CVE-2024-22363 — ReDoS (behoben ab 0.20.2)

Prototype Pollution ist das ernste Problem: trifft beim Einlesen einer Nutzer-Datei, kann
`Object.prototype` verändern — in einer SPA mit Plain-Objects ein Hebel für Logik-Umgehungen.

**Wichtig:** Die reparierten Versionen sind NICHT über npm zu bekommen (Paket unmaintained).
Bezug ausschließlich über `https://cdn.sheetjs.com/`.

Fix: `js/vendor/xlsx.full.min.js` durch Version **≥ 0.20.2** von `cdn.sheetjs.com` ersetzen
(SRI-Hash falls vorhanden aktualisieren, siehe wie andere CDN-Skripte in `app.html` `integrity=`
setzen). Danach `js/vendor/VERSIONS.md` anlegen (Version, Bezugsquelle, Datum) für SheetJS UND
`chart.min.js` (Chart.js 4.4.1, aktuell unauffällig, aber gleiches Problem: kein
Aktualisierungspfad dokumentiert) — verhindert, dass sowas wieder jahrelang unbemerkt bleibt.

Verifikation: Excel-Import (Buchungen, Lager) im Browser einmal durchspielen — Funktion muss
identisch bleiben, nur die Bibliotheksversion ändert sich.

## 🟠 P1 — 2. Backup-Restore schreibt ungefilterte localStorage-Keys aus der Importdatei

Datei: `js/backup-crypto.js`, Funktion `_restore` (~Zeile 215), Helper `_write` (Zeile 68-78),
`_scopeKeys` (Zeile 92-102).

Problem: Export baut das Bundle über eine strenge Allowlist (`_scopeKeys`: nur
`<scope>__reselling_*`, `<scope>__rechnungsbuch_*`, `<scope>__audit_log`, Eigenbeleg-Keys,
`oyi_companies`). **Import prüft davon nichts** — `_restore` iteriert `Object.keys(bundle[scope])`
und schreibt jeden `fullKey` ungeprüft über `_write()`. Alles, was nicht auf
`reselling_`/`rechnungsbuch_`/`audit_log`/`eigenbelege_` matcht, landet direkt in
`localStorage.setItem(fullKey, …)` — eine präparierte Backup-Datei kann damit **beliebige
localStorage-Schlüssel dieses Origins setzen**.

Der Merge-Schutz greift schwächer als er aussieht: `_mergeKey` behält bei Kollision den lokalen
Wert (`(lv !== undefined) ? lv : rv`), aber `_read()` (Zeile 54-59) liefert `undefined` sobald
`JSON.parse(raw)` wirft — alle **nicht-JSON** gespeicherten Schlüssel sind daher auch auf einem
befüllten Profil überschreibbar:

| Schlüssel | Inhalt |
|---|---|
| `whop_access_token` | roher Token-String (`whop-auth.js:303`) |
| `whop_grace_token` | signiertes Grace-Token |
| `oyi_device_owner_uid` | Geräte-Sperre-Marker |
| `oyi_active_company` | aktive Firmen-ID |
| `stackr_lang`, `stackr_lang_chosen` | Sprachwahl |

Angriffsweg: Der Nutzer importiert eine Backup-Datei, die er nicht selbst erzeugt hat (plus
Passphrase) — genau das ist im Produkt vorgesehen (Local→Web-Transfer, StB-Austausch). Die Datei
kann dann Sitzungs-/Identitäts-Keys des Opfers austauschen und Fremddaten als „eigene" Buchhaltung
einschleusen. Kein Prototype-Pollution-Risiko hier (Keys landen in localStorage, nicht als
Objekt-Property).

Fix: In `_restore` jeden `fullKey` vor dem Schreiben gegen dasselbe Muster prüfen, das
`_scopeKeys()` für den Export erzeugt (`reselling_`/`rechnungsbuch_`/`audit_log`/`eigenbelege_`-
Präfixe plus `oyi_companies` für `__account`), und alles andere verwerfen statt zu schreiben.
Import und Export benutzen dann dieselbe Definition von „das gehört zum Backup". Am saubersten:
eine gemeinsame Prüf-Funktion (z.B. `_isAllowedKey(scope, fullKey)`) aus der bestehenden
`_scopeKeys`-Logik extrahieren und in `_restore` aufrufen statt eine zweite, abweichende
Filterliste zu pflegen.

Verifikation: Backup exportieren, Datei manuell um einen fremden Key (z.B. `"evil_key": "x"`) im
JSON-Bundle ergänzen (Achtung: Datei ist AES-GCM-verschlüsselt — Test am einfachsten durch
temporäres Logging von `fullKey` in `_restore` vor dem Fix, oder durch einen Unit-artigen Test,
der `_restore` direkt mit einem präparierten Klartext-Bundle aufruft), Import durchführen, danach
prüfen dass `localStorage.getItem('evil_key')` weiterhin `null` ist und `whop_access_token` etc.
unverändert bleiben.

## 🟡 P2 — 3. `kdf.iterations` wird geschrieben, aber beim Entschlüsseln ignoriert

Datei: `js/backup-crypto.js`, `_decryptFile` (Zeile 197), `_deriveKey` (Zeile 46-51).

Problem: Die Backup-Datei trägt einen vollständigen KDF-Header (Zeile 191:
`kdf: { algo: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: _b64(salt) }`), aber
`_decryptFile` liest daraus nur `salt` (Zeile ~200: `_deriveKey(pass, _unb64(k.salt))`).
`_deriveKey` verwendet fest die Modul-Konstante `ITER` (Zeile 30/49) — `k.iterations`/`k.hash`
werden komplett ignoriert.

Die Falle: Sobald `ITER` später hochgesetzt wird (naheliegend, siehe Fund 5 unten), werden **alle
vorher erzeugten Backups unentschlüsselbar** — mit der Meldung „Falsche Passphrase oder
beschädigte Datei". Für jemanden, der gerade sein einziges Backup zurückspielen will, ist das die
denkbar schlechteste Diagnose: er sucht den Fehler bei seiner Passphrase, nicht bei einer
Codeänderung.

Fix: `_deriveKey(pass, salt, iterations)` um einen dritten Parameter erweitern, in `_decryptFile`
`k.iterations || ITER` übergeben (Fallback für alte Dateien ohne das Feld). **Muss vor jeder
Änderung an `ITER` passieren, nicht danach** — sonst genau die beschriebene Falle.

## 🟡 P2 — 4. StB-Public-Key wird ungeprüft vom Server übernommen

Datei: `js/stb-share.js` (Public-Key-Abruf ~Zeile 227, `api/sync.js:347-353` liefert `get_pubkey`).

Problem: Der Steuerberater-Austausch nutzt ECDH P-256 mit ephemerem Schlüsselpaar pro Envelope
(Forward Secrecy) — sauber gebaut. Aber: Der Mandant holt den öffentlichen Schlüssel des
Steuerberaters per `action:'get_pubkey'` vom Server und wrappt den Datenschlüssel sofort damit,
ohne jede Möglichkeit, die Echtheit außerhalb des Servers zu prüfen (keine `fingerprint`/`verif`/
`digest`-Logik in `js/stb-share.js`). Ein bösartiger oder kompromittierter Server könnte seinen
eigenen Public Key ausliefern, den Envelope entschlüsseln und den Datenschlüssel des Mandanten
erhalten — die E2E-Zusage fällt **für diesen einen Pfad** (nicht für den normalen Selbst-Sync,
dort verlässt der Schlüssel das Gerät nie).

Einordnung: Setzt einen bösartigen Betreiber voraus — also genau das Szenario, gegen das E2E
schützen soll. Kein akuter Massen-Exploit, aber ein Bruch des eigenen Sicherheitsversprechens für
diesen Pfad.

Fix: Beim StB-Einladen einen kurzen Fingerabdruck des Public Keys (SHA-256, erste 8 Hex-Zeichen)
auf **beiden** Seiten (Mandant + Steuerberater) anzeigen — Abgleich z.B. am Telefon. Kleiner
UI-Zusatz in der Einladungs-/Freigabe-Ansicht, schließt die Lücke vollständig. Falls das in dieser
Session zu groß ist: mindestens im UI-Text ehrlich dokumentieren, dass die StB-Freigabe ein
schwächeres Vertrauensmodell hat als der eigene Sync.

## 🟢 P3 (nur falls Zeit übrig — beide erst NACH Fund 3, sonst Altbackups kaputt)

**5. PBKDF2 210.000 Runden mit SHA-256** (`js/backup-crypto.js:30`, Kommentar „≥ 210k (Vorgabe)").
210.000 ist die OWASP-Zahl für PBKDF2-HMAC-**SHA-512**; für **SHA-256** nennt OWASP 600.000 —
ein verbreiteter Zahlendreher. Nicht dramatisch (bei starker Passphrase irrelevant, bei schwacher
rettet auch 600k nichts), aber wenn geändert: `ITER` auf 600000 setzen — **zwingend erst nachdem
Fund 3 (`k.iterations`-Respektierung) sitzt**, sonst werden alle Altbackups unlesbar.

**6. ECDH-Shared-Secret ohne HKDF** (`js/stb-share.js:62-68`, `_sharedKey()`). Nimmt die rohen
256 Bit `deriveBits` direkt als AES-GCM-Schlüssel; Lehrbuchpraxis wäre ein HKDF-Schritt dazwischen
(roher ECDH-Output ist eine x-Koordinate, nicht gleichverteilt). Für P-256+AES-GCM ist kein
praktischer Angriff bekannt — Härtung, kein Loch. Nur anfassen, wenn ohnehin ein
Envelope-Format-Wechsel ansteht (Änderung bricht bestehende Envelopes, braucht ein Versionsfeld).

## Nicht ausnutzbar (bereits geprüft, hier nicht erneut anfassen)

- **XXE in XML-Importen** (`js/bank-import.js:11-12` CAMT.053, `rechnungen/js/erechnung-import.js:53`
  XRechnung/ZUGFeRD): Browser-`DOMParser` löst grundsätzlich keine externen Entities auf.
- **Prototype Pollution im Restore-Merge**: Keys landen in localStorage/IndexedDB, nicht als
  Objekt-Property — kein Pollution-Vektor (Fund 2 oben ist trotzdem real, aber ein anderes Problem:
  beliebiger Key-Overwrite, nicht Prototype Pollution).
- **`js/error-logger.js`**: schreibt nur lokal (max. 50 Einträge), Netzwerk-Versand
  auskommentiert, loggt `location.pathname` ohne Query-String.

## Nach Abschluss

1. `/security-review` erneut laufen lassen um die eigenen Fixes gegenzuchecken.
2. SheetJS-Fix (Fund 1) im Browser verifizieren: Excel-Import in Buchungen UND Lager testen.
3. Fund 2 (Restore-Allowlist) verifizieren wie oben unter „Verifikation" beschrieben.
4. Bei Fund 3/5: einmal ein VOR der Änderung erzeugtes Backup gegen den NACH-der-Änderung-Code
   entschlüsseln lassen — muss weiterhin funktionieren (Regressionstest für die Iterations-Falle).
5. Lokal 1.7 enthält laut Delta-Audit weder `whop-auth.js` noch `api/` — aber `backup-crypto.js`
   ist laut Moduldoku bewusst self-contained und läuft in Web 1.7 UND Local 1.7 identisch. Prüfen
   ob `Local 1.7/js/backup-crypto.js` existiert und gespiegelt werden muss (Fund 2 + 3 betreffen
   dieselbe Datei dort direkt).
