# F6 — Krypto-Worker: gebaut (2026-08-18), verdrahtet (2026-08-21)

**Fertig und committet:** [`js/crypto-worker.js`](../js/crypto-worker.js) + 13 Prüfungen in
[`test/test-crypto-worker.js`](../test/test-crypto-worker.js).

> ✅ **Die Verdrahtung ist am 2026-08-21 erfolgt**, sobald `js/cloud-sync.js` frei war — wie
> unten beschrieben, inklusive Inline-Fallback und erhaltener Fehlerklassifizierung. Die
> Anleitung bleibt als Begründung stehen; **die Erfolgsprognose unten ist aber zu optimistisch,
> siehe „Nachgemessen nach dem Einbau".**

---

## Was die Messung ergeben hat — und warum das die Aufgabe ändert

Das Performance-Audit nimmt an, AES-GCM im Main-Thread sei der Hänger. **Gemessen stimmt das
nicht.** Edge/Chromium, Median aus 5 Läufen nach 2 Warmläufen, gegen die *echte* `_b64`-Funktion
aus `cloud-sync.js:209`:

| Artikel | Klartext | `JSON.stringify` | `TextEncoder` | AES-GCM | base64 | gesamt | Krypto-Anteil |
|---|---|---|---|---|---|---|---|
| 2.000 | 1,05 MB | 3,3 ms | 6,8 ms | 4,3 ms | 2,6 ms | 17 ms | 25 % |
| 8.000 | 4,21 MB | 13,6 ms | 23,3 ms | 8,9 ms | 3,0 ms | 49 ms | 18 % |
| 20.000 | 10,55 MB | 52,5 ms | 75,3 ms | 47,7 ms | 15,9 ms | 191 ms | 25 % |

**Wer nur `crypto.subtle` auslagert, verschiebt ein Viertel und lässt drei Viertel liegen.**
Der Worker nimmt deshalb `TextEncoder` + AES-GCM + base64 als Block; im Main-Thread bleibt nur
`JSON.stringify` — der String muss dort entstehen, wo die Daten liegen.

A/B, 20.000 Artikel: **143,8 ms blockiert → 54,3 ms, also 62 % weniger.**

> ⚠️ Diese Zahlen stammen von einem Desktop. Ein schwaches Android-Gerät liegt grob 3–5× darüber;
> der absolute Gewinn wächst also mit. Wer die Messung wiederholt: **Warmlauf nicht weglassen** —
> der erste Lauf war in unseren Messungen bis zu 5× langsamer als der eingeschwungene Zustand und
> hätte zu einer völlig anderen Empfehlung geführt.

## Was schon geprüft ist

Im Browser gegen einen echten `Worker` und in `test/test-crypto-worker.js`:

- Rundlauf encrypt → decrypt.
- **Byte-Kompatibilität:** Worker-Chiffrat lässt sich mit dem bisherigen Main-Thread-Pfad
  entschlüsseln und umgekehrt. Kein Datenbruch beim Umstieg, kein Migrationslauf nötig.
- **`CryptoKey` überlebt `postMessage` und bleibt nicht-extrahierbar** — das ist die Voraussetzung
  dafür, dass Fund R5 gewahrt bleibt. Der Worker sieht die Rohbytes nie.
- AAD-Bindung an (ownerId, scope) bleibt wirksam; falscher Scope und fremder Owner werden abgewiesen.
- Der AAD-Migrations-Fallback greift **nur** mit `allowNoAad`. Das Ablaufdatum (`AAD_FALLBACK_UNTIL`,
  Fund R7) bleibt bewusst im Aufrufer — der Worker kennt kein Datum.
- CSP: `worker-src` ist weder in `vercel.json` noch in den Meta-Tags gesetzt, es greift
  `default-src 'self'`. Ein gleichnamiger Worker von derselben Herkunft ist damit erlaubt,
  **keine CSP-Änderung nötig.**

## Einbau in `js/cloud-sync.js`

Vier Stellen, alle im Krypto-Block ab Zeile ~281:

1. **Worker lazy anlegen**, nicht beim Laden — die meisten Sitzungen synchronisieren nie.
   Ein Modul-Singleton mit `id`-basierter Zuordnung (mehrere Scopes laufen nacheinander).
2. **`_encrypt(obj, scope, ownerId)`** → `JSON.stringify` bleibt hier, der Rest geht an den Worker.
   Rückgabeformat `{ ct, iv }` ist unverändert.
3. **`_decryptCt(ct, ivB64, scope, ownerId, overrideBytes)`** → Worker liefert den **String**,
   `JSON.parse` bleibt im Aufrufer (sonst wandert ein großer Objektgraph durch den strukturierten
   Klon und kostet so viel wie das Parsen selbst). `allowNoAad: Date.now() <= AAD_FALLBACK_UNTIL`
   übergeben.
4. **`_encryptBytes` / `_decryptBytes`** (Blob-Anhänge) können vorerst bleiben — dort ist der
   Klartext bereits ein `Uint8Array`, `stringify` und `TextEncoder` entfallen also, und der
   Gewinn ist entsprechend klein.

**Fallback nicht vergessen:** schlägt `new Worker(...)` fehl (alte Browser, blockierende
Erweiterung), muss der bisherige Inline-Pfad greifen. Die Funktionen bleiben deshalb bestehen und
werden nur *umgangen*, nicht ersetzt.

**Fehlerklassifizierung erhalten:** `_classifyDecryptError` unterscheidet „Schlüssel passt nicht"
von „Chiffrat nicht ladbar". Der Worker gibt `{ ok:false, error }` zurück; der Aufrufer muss daraus
wieder einen `Error` mit derselben `message` machen, sonst landet ein Netzfehler wieder in der
Meldung „Code falsch" — genau der Bug, der einmal behoben wurde.

## Die zweite Hälfte von F6

Der Aufgabenpunkt verlangt neben dem Worker **sichtbare Rückmeldung**: heute sieht der Nutzer
nicht, dass überhaupt etwas läuft. Der Sync-Punkt in der Topnav existiert (`_setDot`), kennt aber
nur `sync` / `ok` / Fehler. Sinnvoll wäre bei mehreren MB ein Fortschritt pro Scope
(„Firma 2 von 3"). Das ist unabhängig vom Worker und kann auch vorher gebaut werden.

---

## Nachgemessen nach dem Einbau (2026-08-21)

Die A/B-Zahl oben (143,8 ms → 54,3 ms, **62 %**) stammt aus einer Messung der *Krypto-Kette
allein*. Durch die fertige `_encrypt`-Funktion gemessen — also inklusive allem, was zwangsläufig
im Main-Thread bleibt — fällt der Gewinn kleiner aus:

| Weg | Median längste Blockade | Erreichbarkeit des Main-Threads |
|---|---|---|
| Inline (ohne Worker) | **150 ms** | 1 Herzschlag — Thread durchgehend eingefroren |
| Mit Worker | **92,5 ms** | 7 Herzschläge — Thread zwischendurch bedienbar |

Edge/Chromium, 20.000 Artikel / 10,27 MB Klartext, Median aus 5 Läufen nach 2 Warmläufen,
gemessen über `CloudSync._test.encrypt`.

**Also rund 38 % weniger Blockade, nicht 62 %.** Der Unterschied ist kein Fehler der alten
Messung, sondern ihr Zuschnitt: sie ließ weg, was nicht auslagerbar ist.

Davon ist belegt unvermeidbar:

- `JSON.stringify` **35,9 ms** — muss im Main-Thread laufen, dort liegen die Daten.
- Strukturierter Klon des Strings zum Worker **4,3 ms**.

Das erklärt ~40 ms der verbliebenen 92,5 ms. Der Rest ist **nicht sauber zugeordnet**; der
wahrscheinlichste Posten ist der Rückweg: der Worker liefert das base64-Chiffrat als ~13,7 MB
großen String zurück, und **Strings sind nicht transferierbar** — dieser Klon kostet
Main-Thread-Zeit und lässt sich mit diesem Zuschnitt nicht vermeiden. Wer das genauer wissen
will, muss den Rückweg einzeln vermessen; ein Messversuch mit einem `blob:`-Worker scheitert
dabei an der CSP (`worker-src` fällt auf `script-src 'self'` zurück — das ist korrekt so).

**Trotzdem ein echter Gewinn:** entscheidend ist nicht nur die Summe, sondern dass der Thread
überhaupt wieder zwischendurch drankommt (7 statt 1 Herzschlag). Ein durchgehender Freeze von
150 ms ist für den Nutzer etwas anderes als zwei kürzere Blöcke.

> Auf einem schwachen Android-Gerät liegen beide Werte grob 3–5× höher; der absolute Gewinn
> wächst entsprechend mit.

## Was von F6 noch offen ist

Die **sichtbare Rückmeldung** (Abschnitt oben, „Die zweite Hälfte von F6") ist **nicht** gebaut.
`_setDot` kennt weiterhin nur `sync` / `ok` / Fehler, einen Fortschritt pro Scope gibt es nicht.
Das ist unabhängig vom Worker und kann jederzeit nachgezogen werden.
