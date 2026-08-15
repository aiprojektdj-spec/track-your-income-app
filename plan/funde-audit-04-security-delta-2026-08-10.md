# Security-Audit (Delta-Check) — Funde (2026-08-10)

> ## ✅ ERLEDIGT — alle 6 Funde gefixt (Stand 2026-08-10, 22:35)
>
> Eine Parallel-Session hat S1–S6 noch am selben Tag abgearbeitet. **Am Code verifiziert:**
>
> | Fund | Status | Beleg |
> |---|---|---|
> | S1 Restore ohne Key-Allowlist | ✅ | `_isAllowedKey(scope, fullKey)` für **beide** Richtungen in `js/backup-crypto.js` |
> | S2 SheetJS 0.18.5 | ✅ | jetzt `version="0.20.3"`, dazu `js/vendor/VERSIONS.md` |
> | S3 `kdf.iterations` ignoriert | ✅ | `_deriveKey(pass, salt, iterations, hash)`, liest aus dem Dateiheader, `ITER_LEGACY = 210000` als Fallback für Alt-Dateien |
> | S4 StB-Pubkey ohne Prüfung | ✅ | Fingerabdruck-Abgleich in `js/stb-share.js` (Commit `5388954`) |
> | S5 ECDH ohne HKDF | ✅ | HKDF-SHA-256 mit `HKDF_INFO = 'stackr-stb-envelope\|v2'` |
> | S6 PBKDF2 210k | ✅ | `var ITER = 600000` — **korrekt erst nach S3**, wie empfohlen |
>
> Commits: `623ec23`, `5b62268`, `9c395ad`, `5388954`, `35c0cd6`, `cf152e9`.
>
> **Drei Abweichungen von meinen Vorschlägen — alle besser als das Vorgeschlagene:**
> 1. **Kein `integrity=` an `js/vendor/*.js`.** Richtig: SRI schützt bei lokal ausgelieferten
>    Dateien vor nichts. Ersatz: SHA-256 in `VERSIONS.md` + `.gitattributes` mit
>    `js/vendor/*.js -text` — ohne das hätte `core.autocrlf=true` die dokumentierten Hashes
>    beim Checkout zerstört. Auf dieses Detail wäre ich nicht gekommen.
> 2. **Fingerabdruck mit 64 Bit** statt der von mir vorgeschlagenen 32. Korrekt — der Angreifer
>    ist hier per Annahme der Betreiber und kann offline Schlüsselpaare durchprobieren.
> 3. **HKDF mit Versionsfeld (`v:2`)** statt Formatbruch: `unwrapKey` liest die Version aus dem
>    Envelope, fehlendes `v` = v1 = alte Ableitung. Bestehende StB-Freigaben bleiben gültig.
>
> **Nebenbefund der Fix-Session:** `js/backup-crypto.js` in **Local 1.7** hing auf dem Stand vom
> 25.07. und hatte den AAD-Fix vom 30.07. nie bekommen — Local konnte in Web erzeugte Backups
> gar nicht entschlüsseln, mit der irreführenden Meldung „Falsche Passphrase". Inzwischen wieder
> byte-identisch. Das ist genau die Falle, die ich unter **S3** beschrieben habe, nur über den
> Umweg der fehlenden Spiegelung.
>
> **Offen bleibt nur, was einen Whop-Login braucht:** Klick-durch des Excel-Imports mit echter
> Datei und der 2-Account-Test des Fingerabdruck-Abgleichs.
>
> Der Text unten ist der **Befundstand zum Auditzeitpunkt** und bleibt als Begründung stehen.

---


**Session-Prompt:** `plan/session-prompt-audit-04-security-delta-2026-08-10.md`
**Scope:** Web 1.7, Delta seit der Sanierung 2026-08-09/10.
**Methode:** `git log` seit `020a0c5`, Abgleich der zwei offenen Punkte aus
`memory/security-audit-fixes-2026-08-10`, danach gezielt die Flächen geprüft, die **weder** der
Sanierungs-Diff **noch** das heutige Red-Team ([Funde #1](funde-audit-01-red-team-2026-08-10.md))
angefasst haben.

---

## Ausgangslage: es gibt keinen Code-Delta

`git log --since=2026-08-08` zeigt: **HEAD ist unverändert `020a0c5`** — seit der Sanierung wurde
kein einziger Commit gemacht. Uncommittet sind ausschließlich Plan-/Fund-Dateien dieser
Audit-Runde, kein Produktivcode.

Ein reiner „Delta-Scan" wäre damit leer gelaufen. Der Sanierungs-Review lief seinerzeit
ausdrücklich nur **gegen den Diff** — alles, was damals nicht angefasst wurde, ist also
seit Längerem ungeprüft. Genau dort habe ich angesetzt: **Import-Pfade, Backup-Krypto,
StB-Envelope-Krypto, mitgelieferte Fremdbibliotheken.** Das sind vier Flächen, die in keinem
bisherigen Audit vorkamen.

**Ergebnis: 6 neue Funde, davon 2 mit P1.**

| # | Fund | Fläche | Severity |
|---|---|---|---|
| S1 | Backup-Restore schreibt ungefilterte localStorage-Keys aus der Importdatei | Import | 🟠 P1 |
| S2 | Mitgeliefertes SheetJS 0.18.5 mit zwei bekannten CVEs | Supply-Chain | 🟠 P1 |
| S3 | `backup-crypto` ignoriert `kdf.iterations` aus der Datei → latente Datenverlust-Falle | Krypto | 🟡 P2 |
| S4 | StB-Public-Key ohne Out-of-Band-Prüfung → Server kann den E2E-Pfad brechen | Krypto | 🟡 P2 |
| S5 | ECDH-Shared-Secret ohne HKDF direkt als AES-Schlüssel | Krypto | 🟢 P3 |
| S6 | PBKDF2 210.000 Runden mit SHA-256 (OWASP nennt 600.000) | Krypto | 🟢 P3 |

---

## Abgleich der zwei offenen Punkte aus dem Memory

### ✅ Punkt 2 — „Muss Local 1.7 gespiegelt werden?" → **Nein, geklärt**

`Local 1.7` enthält **keine** der gefixten Dateien:

- kein `js/whop-auth.js` (der Fokus-Trap-Fix `aa1c941` betrifft es also nicht)
- kein `api/`-Verzeichnis (die Fixes `a4ade79` anchorKey und `b90c0bd` IP-Rate-Limit
  betreffen ausschließlich Serverless-Endpunkte, die es in Local nicht gibt)
- kein `cloud-sync.js`, `stb-share.js`, `blob-attachments.js`, `webhooks.js`
- stattdessen `js/license.js` — Local nutzt ein eigenes Offline-Lizenzmodell

**Es gibt nichts zu spiegeln.** Der Punkt kann im Memory geschlossen werden.

**Nebenbefund (kein Sicherheitsproblem, aber Aufräumkandidat):** `Local 1.7/js/app.js:95-103`
ruft noch `AuthUI.boot()` auf, mit dem Kommentar *„Supabase-First: AuthUI prüft Session, pullt
Cloud-Daten"*. `AuthUI` existiert in Local nicht (Suche: null Treffer), und Supabase ist seit
der Whop-Migration tot. Der Guard `typeof AuthUI !== 'undefined'` fängt es korrekt ab und fällt
auf `_continueInit()` zurück — funktional harmlos, aber irreführender toter Code plus falscher
Kommentar.

### ⏳ Punkt 1 — Edge-Tastaturtest → **bleibt offen, nur durch dich machbar**

Unverändert: Die Browser-Automatisierung hat kein echtes `document.hasFocus()`, daher lässt sich
die native Tab-Traversierung und der sichtbare Fokus-Ring nicht verifizieren — nur die Wrap-Logik
per synthetischem `KeyboardEvent` (die stimmt). Bleibt ein manueller Test in Edge.

---

## 🟠 P1 — S1: Backup-Restore schreibt ungefilterte localStorage-Keys

**Die Export-Seite ist diszipliniert, die Import-Seite nicht.**

`_scopeKeys()` ([js/backup-crypto.js:92-105](../js/backup-crypto.js#L92)) baut das Bundle über eine
strenge Allowlist: nur `<scope>__reselling_*`, `<scope>__rechnungsbuch_*`, `<scope>__audit_log`,
die bekannten Eigenbeleg-Keys und `oyi_companies`.

`_restore()` ([js/backup-crypto.js:~220](../js/backup-crypto.js)) prüft davon **nichts**:

```javascript
Object.keys(bundle).forEach(function (scope) {
    var remoteKeys = bundle[scope] || {};
    Object.keys(remoteKeys).forEach(function (fullKey) {
        var merged = _mergeKey(fullKey, _read(fullKey), remoteKeys[fullKey]);
        writes.push(_write(fullKey, merged));      // ← fullKey kommt ungeprüft aus der Datei
    });
});
```

`_write()` ([js/backup-crypto.js:68-78](../js/backup-crypto.js#L68)) routet alles, was **nicht**
`reselling_`/`rechnungsbuch_`/`audit_log`/`eigenbelege_` ist, direkt in
`localStorage.setItem(fullKey, …)`. Eine präparierte Backup-Datei kann damit **beliebige
localStorage-Schlüssel dieses Origins setzen**.

**Der Merge-Schutz greift schwächer als er aussieht.** `_mergeKey` gibt bei Kollision den lokalen
Wert zurück (`(lv !== undefined) ? lv : rv`) — aber `_read()`
([js/backup-crypto.js:54-59](../js/backup-crypto.js#L54)) liefert `undefined`, sobald
`JSON.parse(raw)` wirft. Alle **nicht-JSON** gespeicherten Schlüssel sind daher auch auf einem
befüllten Profil überschreibbar, darunter:

| Schlüssel | Inhalt | JSON? |
|---|---|---|
| `whop_access_token` | roher Token-String ([whop-auth.js:303](../js/whop-auth.js#L303)) | ❌ → überschreibbar |
| `whop_grace_token` | `payload.sig`-String | ❌ → überschreibbar |
| `oyi_device_owner_uid` | reine User-ID | ❌ → überschreibbar |
| `oyi_active_company` | reine ID | ❌ → überschreibbar |
| `stackr_lang`, `stackr_lang_chosen` | Kurzstrings | ❌ → überschreibbar |

**Angriffsweg:** Der Nutzer importiert eine Backup-Datei, die er nicht selbst erzeugt hat, plus
Passphrase. Genau das ist in diesem Produkt ein **vorgesehener Vorgang** — der Local→Web-Transfer
und der Steuerberater-Austausch laufen so. Die Datei kann dann die Sitzungs- und Identitäts-Keys
des Opfers austauschen und beliebige Fremddaten als „eigene" Buchhaltung einschleusen.

Kein Prototype-Pollution-Risiko an dieser Stelle: die Keys landen in localStorage, nicht als
Property auf einem JS-Objekt.

**Fix (klein, passt zum vorhandenen Code):** In `_restore` jeden `fullKey` gegen dasselbe Muster
prüfen, das `_scopeKeys()` erzeugt, und Unbekanntes verwerfen statt zu schreiben. Import und
Export benutzen dann dieselbe Definition von „das gehört zum Backup".

---

## 🟠 P1 — S2: Mitgeliefertes SheetJS 0.18.5 mit zwei bekannten CVEs

`js/vendor/xlsx.full.min.js` ist **Version 0.18.5** (im Bundle als `version="0.18.5"` lesbar).
Geladen wird sie in [app.html:239](../app.html#L239) und
[lager/index.html:209](../lager/index.html#L209), verwendet in `js/app.js`, `js/buchungen.js`,
`js/lager.js`, `lager/page.js` — also auf dem **Excel-Import-Pfad**, der per Definition
fremde Dateien verarbeitet.

| CVE | Art | Betroffen | Behoben ab |
|---|---|---|---|
| CVE-2023-30533 | **Prototype Pollution** beim Lesen präparierter Dateien | alle ≤ 0.19.2 | **0.19.3** |
| CVE-2024-22363 | ReDoS | alle ≤ 0.20.1 | **0.20.2** |

Prototype Pollution ist hier das ernste Problem: sie trifft genau beim Einlesen einer
Nutzer-Datei und kann `Object.prototype` verändern — in einer SPA, die durchgehend mit
Plain-Objects arbeitet, ist das ein Hebel für Logik-Umgehungen. Der ReDoS-Fund bedeutet in
einer Single-User-App nur einen hängenden Tab.

**Wichtiges operatives Detail:** Die reparierten Versionen sind **nicht über npm** zu bekommen —
das npm-Paket wird nicht mehr gepflegt. Bezug ausschließlich über `https://cdn.sheetjs.com/`.
Ziel: **0.20.2 oder neuer**, damit beide CVEs erledigt sind.

**Systemischer Punkt dahinter:** Die CDN-Einbindungen sind vorbildlich mit SRI und `crossorigin`
abgesichert (siehe Red-Team-Audit) — die **lokal einkopierten** Bibliotheken unter `js/vendor/`
haben dagegen weder Versionsmanifest noch Aktualisierungspfad. Neben SheetJS liegt dort
`chart.min.js` (Chart.js 4.4.1, aktuell unauffällig). Empfehlung: eine kurze
`js/vendor/VERSIONS.md` mit Version, Bezugsquelle und Datum, damit so etwas nicht erneut
jahrelang unbemerkt liegen bleibt.

---

## 🟡 P2 — S3: `kdf.iterations` wird geschrieben, aber beim Entschlüsseln ignoriert

Die Backup-Datei trägt einen vollständigen KDF-Header
([js/backup-crypto.js:191](../js/backup-crypto.js#L191)):

```javascript
kdf: { algo: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: _b64(salt) }
```

`_decryptFile` liest daraus aber **nur `salt`**
([js/backup-crypto.js:200](../js/backup-crypto.js#L200)):

```javascript
var key = await _deriveKey(pass, _unb64(k.salt));   // k.iterations, k.hash: ignoriert
```

`_deriveKey` verwendet fest die Modul-Konstante `ITER`
([js/backup-crypto.js:30,49](../js/backup-crypto.js#L30)). Der Header verspricht also
Algorithmus-Flexibilität, die der Code nicht einlöst.

**Die Falle:** Sobald jemand `ITER` hochsetzt — was aus S6 heraus naheliegt — werden **alle
vorher erzeugten Backups unentschlüsselbar**. Und zwar mit dieser Meldung:

> „Falsche Passphrase oder beschädigte Datei."

Das ist die denkbar schlechteste Diagnose für jemanden, der gerade sein einziges Backup
zurückspielen will: er sucht den Fehler bei seiner Passphrase, nicht bei einer Codeänderung.

**Fix:** `_deriveKey(pass, salt, iterations)` parametrisieren und beim Entschlüsseln
`k.iterations || ITER` übergeben. Zwei Zeilen — und sie müssen **vor** einer Änderung an `ITER`
passieren, nicht danach.

---

## 🟡 P2 — S4: StB-Public-Key wird ungeprüft vom Server übernommen

Der Steuerberater-Austausch ist sauber gebaut: ECDH P-256, **ephemeres** Schlüsselpaar pro
Envelope (Forward Secrecy), privater Schlüssel als nicht-extrahierbarer `CryptoKey`
([js/stb-share.js:36,74,148](../js/stb-share.js#L36)).

Die Schwachstelle liegt nicht in der Krypto, sondern in der **Schlüsselverteilung**: Der Mandant
holt den öffentlichen Schlüssel des Steuerberaters per `action:'get_pubkey'` vom Server
([api/sync.js:347-353](../api/sync.js#L347)) und wrappt den Datenschlüssel sofort damit
([js/stb-share.js:227](../js/stb-share.js#L227)). Eine Suche nach `fingerprint`, `verif` oder
`digest` in `js/stb-share.js` liefert **null Treffer** — es gibt keinen Weg, die Echtheit des
Schlüssels außerhalb des Servers zu prüfen.

Ein bösartiger oder kompromittierter Server kann also seinen **eigenen** Public Key ausliefern,
den Envelope entschlüsseln und den Datenschlüssel des Mandanten erhalten — womit die
Ende-zu-Ende-Zusage **für diesen einen Pfad** fällt. Für den normalen Selbst-Sync gilt das nicht:
dort verlässt der Schlüssel das Gerät nie.

**Einordnung:** Setzt einen bösartigen Betreiber voraus — also genau das Szenario, gegen das E2E
überhaupt schützen soll. Der Rest des Produkts hält diesem Anspruch stand, dieser Pfad nicht.

**Fix:** Beim Einladen einen kurzen Fingerabdruck des Public Keys (SHA-256, erste 8 Zeichen)
auf **beiden** Seiten anzeigen — der Mandant liest ihn dem Steuerberater am Telefon vor. Kleiner
UI-Zusatz, schließt die Lücke vollständig. Alternativ ehrlich dokumentieren, dass die
StB-Freigabe ein schwächeres Vertrauensmodell hat als der eigene Sync.

---

## 🟢 P3 — S5 und S6 (Krypto-Hygiene, nicht ausnutzbar)

**S5 — ECDH-Shared-Secret ohne HKDF.** `_sharedKey()`
([js/stb-share.js:62-68](../js/stb-share.js#L62)) nimmt die 256 rohen `deriveBits` und importiert
sie direkt als AES-GCM-Schlüssel. Der rohe ECDH-Output ist eine x-Koordinate und damit nicht
gleichverteilt; Lehrbuchpraxis ist ein HKDF-Schritt dazwischen. Für P-256 + AES-GCM ist kein
praktischer Angriff bekannt — es ist eine Härtung, kein Loch. Falls angefasst: Änderung bricht
bestehende Envelopes, also nur zusammen mit einem Versionsfeld.

**S6 — PBKDF2 210.000 Runden mit SHA-256.** Der Kommentar sagt „≥ 210k (Vorgabe)"
([js/backup-crypto.js:30](../js/backup-crypto.js#L30)). 210.000 ist allerdings die OWASP-Zahl für
PBKDF2-HMAC-**SHA-512**; für **SHA-256** nennt OWASP 600.000. Ein verbreiteter Zahlendreher.
Nicht dramatisch — bei einer starken Passphrase spielt der Faktor 3 keine Rolle, bei einer
schwachen rettet auch 600.000 nichts. **Wenn geändert, dann zwingend zusammen mit S3**, sonst
werden alle Altbackups unlesbar.

---

## Nicht ausnutzbar (geprüft)

**XXE in den XML-Importen.** `js/bank-import.js:11-12` (CAMT.053) und
`rechnungen/js/erechnung-import.js:53` (XRechnung/ZUGFeRD) verwenden beide `DOMParser` mit
`'application/xml'`. Browser-DOMParser löst grundsätzlich keine externen Entities auf — kein
XXE, kein Billion-Laughs über diesen Weg.

**Prototype Pollution im Restore-Merge.** Siehe S1: die Keys landen in localStorage bzw.
IndexedDB, nicht als Property-Zuweisung auf einem Objekt. `Object.keys()` iteriert zwar ein per
`JSON.parse` erzeugtes eigenes `__proto__`-Property mit, aber `_write` macht daraus nur einen
localStorage-Eintrag dieses Namens.

**Fehler-Logger.** `js/error-logger.js` schreibt ausschließlich lokal (max. 50 Einträge in
localStorage); der Netzwerk-Versand in `_send()` ist auskommentiert. Geloggt wird
`location.pathname` **ohne** Query-String — keine Datenabflüsse.

---

## Stichproben an bereits gefixten Punkten (Auftrag: nicht erneut vollscannen)

- `api/sync.js action=delete` löscht `anchorKey` nachweislich nicht mehr mit
  ([api/sync.js:296-304](../api/sync.js#L296)) — Fix `a4ade79` sitzt, inklusive Begründung im Kommentar.
- Alle drei Endpunkte lesen `x-vercel-forwarded-for` zuerst
  ([sync.js:162](../api/sync.js#L162), [whop-access.js:156](../api/whop-access.js#L156),
  [whop-token.js:36](../api/whop-token.js#L36)) — Fix `b90c0bd` sitzt.
- `_trapFocus`/`_lockBackground` sperren alle Body-Geschwister per `inert` + `aria-hidden` und
  werden von allen drei Gate-Overlays benutzt
  ([whop-auth.js:139-200, 435, 562, 618](../js/whop-auth.js#L139)) — Fix `aa1c941` sitzt.

---

## Empfohlene Reihenfolge

1. **S2** — SheetJS auf ≥ 0.20.2 von `cdn.sheetjs.com` heben. Reiner Dateitausch, schließt zwei CVEs.
2. **S1** — Allowlist im `_restore`. Kleiner Eingriff, schließt den einzigen Weg, über den eine
   fremde Datei Sitzungs-Keys überschreiben kann.
3. **S3** — `k.iterations` beim Entschlüsseln respektieren. **Vor** jeder Änderung an `ITER`.
4. **S4** — Fingerabdruck-Anzeige beim StB-Einladen, oder das schwächere Vertrauensmodell
   dokumentieren.
5. **S6** — `ITER` auf 600.000, aber erst nachdem S3 sitzt.
6. **S5** — nur bei einem ohnehin anstehenden Envelope-Format-Wechsel.
7. `js/vendor/VERSIONS.md` anlegen, damit vendorierte Bibliotheken einen Aktualisierungspfad haben.

---

## Quellen

- [SheetJS Advisory CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533)
- [SheetJS Advisory CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363)
- [Snyk — ReDoS in xlsx (CVE-2024-22363)](https://security.snyk.io/vuln/SNYK-JS-XLSX-6252523)
- [SheetJS Issue #2961 — 0.19.3 nicht auf npm](https://git.sheetjs.com/sheetjs/sheetjs/issues/2961)
